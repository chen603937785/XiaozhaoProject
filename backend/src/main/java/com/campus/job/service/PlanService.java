package com.campus.job.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.campus.job.common.BusinessException;
import com.campus.job.common.UserContext;
import com.campus.job.entity.JobStatus;
import com.campus.job.entity.Plan;
import com.campus.job.mapper.JobStatusMapper;
import com.campus.job.mapper.PlanMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 求职计划服务：多计划管理 + 岗位归属 + 按计划统计
 */
@Service
@RequiredArgsConstructor
public class PlanService {

    private final PlanMapper planMapper;
    private final JobStatusMapper jobStatusMapper;

    private Long userId() {
        Long uid = UserContext.getUserId();
        if (uid == null) {
            throw new BusinessException(401, "未登录");
        }
        return uid;
    }

    private Plan getOwnedPlan(Long uid, Long planId) {
        return planMapper.selectOne(new LambdaQueryWrapper<Plan>()
                .eq(Plan::getUserId, uid).eq(Plan::getId, planId));
    }

    // ===== 列表（含统计） =====

    public List<Map<String, Object>> list() {
        Long uid = userId();
        List<Plan> plans = planMapper.selectList(new LambdaQueryWrapper<Plan>()
                .eq(Plan::getUserId, uid)
                .orderByDesc(Plan::getIsActive)
                .orderByDesc(Plan::getCreatedAt));

        List<JobStatus> statuses = jobStatusMapper.selectList(new LambdaQueryWrapper<JobStatus>()
                .eq(JobStatus::getUserId, uid));
        Map<Long, Map<String, Integer>> stat = new HashMap<>();
        for (JobStatus s : statuses) {
            if (s.getPlanId() == null) continue;
            Map<String, Integer> m = stat.computeIfAbsent(s.getPlanId(), k -> new HashMap<>());
            m.merge("jobCount", 1, Integer::sum);
            String ms = s.getMainStatus();
            if ("APPLIED".equals(ms)) m.merge("applied", 1, Integer::sum);
            if ("INTERVIEW".equals(ms)) m.merge("interview", 1, Integer::sum);
            if ("OFFER".equals(ms)) m.merge("offer", 1, Integer::sum);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Plan p : plans) {
            Map<String, Integer> m = stat.getOrDefault(p.getId(), new HashMap<>());
            int jobCount = m.getOrDefault("jobCount", 0);
            int applied = m.getOrDefault("applied", 0);
            int interview = m.getOrDefault("interview", 0);
            int offer = m.getOrDefault("offer", 0);

            Map<String, Object> item = new HashMap<>();
            item.put("id", p.getId());
            item.put("planName", p.getPlanName());
            item.put("recruitmentStage", p.getRecruitmentStage());
            item.put("startDate", p.getStartDate());
            item.put("endDate", p.getEndDate());
            item.put("targetPositions", p.getTargetPositions());
            item.put("targetCities", p.getTargetCities());
            item.put("targetApplyCount", p.getTargetApplyCount());
            item.put("targetInterviewCount", p.getTargetInterviewCount());
            item.put("targetOfferCount", p.getTargetOfferCount());
            item.put("status", p.getStatus());
            item.put("isActive", p.getIsActive());
            item.put("jobCount", jobCount);
            item.put("appliedCount", applied);
            item.put("interviewCount", interview);
            item.put("offerCount", offer);
            item.put("completion", completion(applied, p.getTargetApplyCount()));
            result.add(item);
        }
        return result;
    }

    private int completion(int applied, Integer target) {
        if (target == null || target <= 0) return 0;
        return Math.min(100, Math.round(applied * 100f / target));
    }

    // ===== 创建 / 编辑 =====

    @Transactional
    public Long create(Map<String, Object> body) {
        Long uid = userId();
        Plan p = new Plan();
        p.setUserId(uid);
        applyBody(p, body);
        String status = body.get("status") == null ? "DRAFT" : String.valueOf(body.get("status"));
        p.setStatus(status);
        p.setIsActive("IN_PROGRESS".equals(status) ? 1 : 0);
        LocalDateTime now = LocalDateTime.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        planMapper.insert(p);
        if ("IN_PROGRESS".equals(status)) {
            deactivateOthers(uid, p.getId());
        }
        return p.getId();
    }

    @Transactional
    public void update(Long id, Map<String, Object> body) {
        Long uid = userId();
        Plan p = getOwnedPlan(uid, id);
        if (p == null) throw new BusinessException(404, "计划不存在");
        applyBody(p, body);
        p.setUpdatedAt(LocalDateTime.now());
        planMapper.updateById(p);
    }

    private void applyBody(Plan p, Map<String, Object> body) {
        if (body.get("planName") != null) p.setPlanName(String.valueOf(body.get("planName")));
        if (body.get("recruitmentStage") != null) p.setRecruitmentStage(String.valueOf(body.get("recruitmentStage")));
        if (body.get("startDate") != null && StringUtils.hasText(String.valueOf(body.get("startDate"))))
            p.setStartDate(LocalDate.parse(String.valueOf(body.get("startDate"))));
        if (body.get("endDate") != null && StringUtils.hasText(String.valueOf(body.get("endDate"))))
            p.setEndDate(LocalDate.parse(String.valueOf(body.get("endDate"))));
        if (body.get("targetPositions") != null) p.setTargetPositions(String.valueOf(body.get("targetPositions")));
        if (body.get("targetCities") != null) p.setTargetCities(String.valueOf(body.get("targetCities")));
        if (body.get("targetApplyCount") != null) p.setTargetApplyCount(toInt(body.get("targetApplyCount")));
        if (body.get("targetInterviewCount") != null) p.setTargetInterviewCount(toInt(body.get("targetInterviewCount")));
        if (body.get("targetOfferCount") != null) p.setTargetOfferCount(toInt(body.get("targetOfferCount")));
    }

    private Integer toInt(Object o) {
        if (o == null) return 0;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(String.valueOf(o)); } catch (Exception e) { return 0; }
    }

    // ===== 状态流转 =====

    /** 设为进行中（原进行中自动暂停） */
    @Transactional
    public void setActive(Long id) {
        Long uid = userId();
        Plan p = getOwnedPlan(uid, id);
        if (p == null) throw new BusinessException(404, "计划不存在");
        if ("ARCHIVED".equals(p.getStatus())) throw new BusinessException(400, "已归档计划不能设为进行中");
        deactivateOthers(uid, id);
        p.setStatus("IN_PROGRESS");
        p.setIsActive(1);
        p.setUpdatedAt(LocalDateTime.now());
        planMapper.updateById(p);
    }

    private void deactivateOthers(Long uid, Long activeId) {
        List<Plan> actives = planMapper.selectList(new LambdaQueryWrapper<Plan>()
                .eq(Plan::getUserId, uid).eq(Plan::getStatus, "IN_PROGRESS"));
        for (Plan a : actives) {
            if (!a.getId().equals(activeId)) {
                a.setStatus("PAUSED");
                a.setIsActive(0);
                a.setUpdatedAt(LocalDateTime.now());
                planMapper.updateById(a);
            }
        }
    }

    @Transactional
    public void pause(Long id) {
        Long uid = userId();
        Plan p = getOwnedPlan(uid, id);
        if (p == null) throw new BusinessException(404, "计划不存在");
        if (!"IN_PROGRESS".equals(p.getStatus())) throw new BusinessException(400, "仅进行中的计划可暂停");
        p.setStatus("PAUSED");
        p.setIsActive(0);
        p.setUpdatedAt(LocalDateTime.now());
        planMapper.updateById(p);
    }

    @Transactional
    public void complete(Long id) {
        Long uid = userId();
        Plan p = getOwnedPlan(uid, id);
        if (p == null) throw new BusinessException(404, "计划不存在");
        p.setStatus("COMPLETED");
        p.setIsActive(0);
        p.setUpdatedAt(LocalDateTime.now());
        planMapper.updateById(p);
    }

    @Transactional
    public void archive(Long id) {
        Long uid = userId();
        Plan p = getOwnedPlan(uid, id);
        if (p == null) throw new BusinessException(404, "计划不存在");
        p.setStatus("ARCHIVED");
        p.setIsActive(0);
        p.setUpdatedAt(LocalDateTime.now());
        planMapper.updateById(p);
    }

    /** 恢复（已归档/已完成 → 已暂停，可再次启用） */
    @Transactional
    public void restore(Long id) {
        Long uid = userId();
        Plan p = getOwnedPlan(uid, id);
        if (p == null) throw new BusinessException(404, "计划不存在");
        p.setStatus("PAUSED");
        p.setIsActive(0);
        p.setUpdatedAt(LocalDateTime.now());
        planMapper.updateById(p);
    }

    @Transactional
    public void delete(Long id) {
        Long uid = userId();
        Plan p = getOwnedPlan(uid, id);
        if (p == null) throw new BusinessException(404, "计划不存在");
        if ("IN_PROGRESS".equals(p.getStatus())) throw new BusinessException(400, "进行中的计划不能删除");
        // 名下岗位解除归属（显式置 null，避免 MyBatis-Plus 忽略 null 字段）
        jobStatusMapper.update(null, new LambdaUpdateWrapper<JobStatus>()
                .eq(JobStatus::getUserId, uid)
                .eq(JobStatus::getPlanId, id)
                .set(JobStatus::getPlanId, null));
        planMapper.deleteById(id);
    }

    // ===== 移动岗位 =====

    @Transactional
    public void moveJob(Long jobId, Long targetPlanId, Boolean resetStatus) {
        Long uid = userId();
        Plan target = getOwnedPlan(uid, targetPlanId);
        if (target == null) throw new BusinessException(404, "目标计划不存在");
        if ("COMPLETED".equals(target.getStatus()) || "ARCHIVED".equals(target.getStatus())) {
            throw new BusinessException(400, "已完成或已归档计划不能添加岗位");
        }
        JobStatus s = jobStatusMapper.selectOne(new LambdaQueryWrapper<JobStatus>()
                .eq(JobStatus::getUserId, uid).eq(JobStatus::getJobId, jobId));
        if (s == null) throw new BusinessException(404, "该岗位尚未关注");
        if (targetPlanId.equals(s.getPlanId())) return;
        s.setPlanId(targetPlanId);
        if (Boolean.TRUE.equals(resetStatus)) {
            s.setMainStatus("TO_EVALUATE");
            s.setSubStatus(null);
            s.setStatusChangedAt(LocalDateTime.now());
        }
        jobStatusMapper.updateById(s);
    }
}
