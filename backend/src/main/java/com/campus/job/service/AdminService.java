package com.campus.job.service;

import cn.hutool.core.text.csv.CsvData;
import cn.hutool.core.text.csv.CsvReader;
import cn.hutool.core.text.csv.CsvUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.campus.job.common.BusinessException;
import com.campus.job.common.JwtUtil;
import com.campus.job.entity.Favorite;
import com.campus.job.entity.Job;
import com.campus.job.entity.User;
import com.campus.job.mapper.FavoriteMapper;
import com.campus.job.mapper.JobMapper;
import com.campus.job.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.StringReader;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 管理后台服务
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserMapper userMapper;
    private final JobMapper jobMapper;
    private final FavoriteMapper favoriteMapper;
    private final JwtUtil jwtUtil;

    @Value("${admin.username}")
    private String adminUsername;

    @Value("${admin.password}")
    private String adminPassword;

    /**
     * 管理员登录
     */
    public String login(String username, String password) {
        if (adminUsername.equals(username) && adminPassword.equals(password)) {
            return jwtUtil.createAdminToken(username);
        }
        throw new BusinessException(401, "用户名或密码错误");
    }

    /**
     * 统计概览
     */
    public Map<String, Object> stats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("userCount", userMapper.selectCount(null));
        stats.put("jobOnline", jobMapper.selectCount(new QueryWrapper<Job>().eq("status", 1)));
        stats.put("jobOffline", jobMapper.selectCount(new QueryWrapper<Job>().eq("status", 0)));
        stats.put("favoriteCount", favoriteMapper.selectCount(null));
        stats.put("todayUsers", userMapper.selectCount(
                new QueryWrapper<User>().ge("created_at", LocalDate.now().atStartOfDay())));
        return stats;
    }

    /**
     * 用户列表(分页)
     */
    public Map<String, Object> userList(int page, int size) {
        Page<User> p = userMapper.selectPage(
                new Page<>(page, size),
                new QueryWrapper<User>().orderByDesc("id"));
        return buildPageResult(p);
    }

    /**
     * 设置用户会员(是否会员 + 到期时间)
     */
    public void updateUserVip(Long id, Boolean isVip, String expire) {
        User user = new User();
        user.setId(id);
        user.setIsVip(Boolean.TRUE.equals(isVip) ? 1 : 0);
        if (Boolean.TRUE.equals(isVip) && StringUtils.hasText(expire)) {
            try {
                user.setVipExpire(LocalDateTime.parse(expire.trim() + "T23:59:59"));
            } catch (Exception e) {
                user.setVipExpire(null);
            }
        } else {
            user.setVipExpire(null);
        }
        userMapper.updateById(user);
    }

    /**
     * 岗位列表(管理端, 可看全部状态)
     */
    public Map<String, Object> jobList(int page, int size, String keyword, Integer status) {
        QueryWrapper<Job> wrapper = new QueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            String kw = keyword.trim();
            wrapper.and(w -> w.like("company_name", kw).or().like("positions", kw));
        }
        if (status != null) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("id");
        Page<Job> p = jobMapper.selectPage(new Page<>(page, size), wrapper);
        return buildPageResult(p);
    }

    /**
     * 上下架岗位
     */
    public void updateStatus(Long id, Integer status) {
        Job job = new Job();
        job.setId(id);
        job.setStatus(status);
        jobMapper.updateById(job);
    }

    /**
     * 导入 CSV (全量替换)
     */
    public int importCsv(String csvContent) {
        if (!StringUtils.hasText(csvContent)) {
            throw new BusinessException(400, "CSV 内容为空");
        }
        List<Job> jobs = parseCsv(csvContent);
        if (jobs.isEmpty()) {
            throw new BusinessException(400, "CSV 无有效数据");
        }
        // 全量替换
        jobMapper.delete(null);
        for (Job job : jobs) {
            job.setStatus(1);
            jobMapper.insert(job);
        }
        return jobs.size();
    }

    /**
     * 解析 CSV 为 Job 列表 (列顺序与 jobs.csv 一致)
     */
    private List<Job> parseCsv(String csvContent) {
        CsvReader reader = CsvUtil.getReader();
        CsvData data = reader.read(new StringReader(csvContent));
        List<Job> jobs = new ArrayList<>();
        List<cn.hutool.core.text.csv.CsvRow> rows = data.getRows();
        for (int i = 1; i < rows.size(); i++) {
            List<String> cols = rows.get(i).getRawList();
            if (cols.size() < 19) {
                continue;
            }
            Job job = new Job();
            job.setPublishDate(parseDate(cols.get(0)));
            job.setCompanyName(cols.get(1));
            job.setIndustry(cols.get(2));
            job.setIndustryRaw(cols.get(3));
            job.setRecruitTypes(cols.get(4));
            job.setRecruitTypeRaw(cols.get(5));
            job.setCompanyNature(cols.get(6));
            job.setCompanyNatureRaw(cols.get(7));
            job.setTargetRaw(cols.get(8));
            job.setGradeMin(parseInt(cols.get(9)));
            job.setGradeMax(parseInt(cols.get(10)));
            job.setEducation(cols.get(11));
            job.setPositions(cols.get(12));
            job.setCities(cols.get(13));
            job.setNoticeUrl(cols.get(14));
            job.setApplyUrl(cols.get(15));
            job.setDeadline(cols.get(16));
            job.setDeadlineDate(parseDate(cols.get(17)));
            job.setRemark(cols.get(18));
            jobs.add(job);
        }
        return jobs;
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.trim().isEmpty() || "NULL".equalsIgnoreCase(s.trim())) {
            return null;
        }
        try {
            return LocalDate.parse(s.trim().substring(0, 10));
        } catch (Exception e) {
            return null;
        }
    }

    private Integer parseInt(String s) {
        if (s == null || s.trim().isEmpty() || "NULL".equalsIgnoreCase(s.trim())) {
            return null;
        }
        try {
            return Integer.valueOf(s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> buildPageResult(Page<?> page) {
        Map<String, Object> result = new HashMap<>();
        result.put("total", page.getTotal());
        result.put("pages", page.getPages());
        result.put("current", page.getCurrent());
        result.put("size", page.getSize());
        result.put("records", page.getRecords());
        return result;
    }
}
