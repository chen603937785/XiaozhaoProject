package com.campus.job.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.campus.job.common.ProvinceCity;
import com.campus.job.dto.JobQuery;
import com.campus.job.entity.Job;
import com.campus.job.mapper.JobMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 岗位服务
 */
@Service
@RequiredArgsConstructor
public class JobService {

    private final JobMapper jobMapper;

    /**
     * 标准筛选项字典(与清洗脚本 meta.json 保持一致)
     */
    private static final List<String> INDUSTRIES = Arrays.asList(
            "互联网/软件/游戏", "电子/半导体/通信", "智能硬件/机器人", "机械/制造/汽车",
            "金融", "银行", "咨询/财会/法律", "传媒/文化/出版", "教育培训/科研",
            "医疗/生物医药", "能源/化工/环保", "建筑/地产", "交通运输/物流",
            "消费品/零售/快消", "政府/事业单位/公共服务", "国防军工/航空航天",
            "农业/农林牧渔", "其他");

    private static final List<String> RECRUIT_TYPES = Arrays.asList(
            "秋招提前批", "秋招", "春招补招", "春招", "暑期实习", "寒假实习",
            "日常实习", "实习", "转正实习", "校园大使", "商赛/训练营", "社招");

    private static final List<String> NATURES = Arrays.asList(
            "民企", "央国企", "外企/合资", "事业单位", "社会机构/公益组织", "其他");

    private static final List<String> EDUCATIONS = Arrays.asList(
            "不限", "高中", "专科", "本科", "硕士", "博士");

    /**
     * 分页查询岗位
     */
    public Map<String, Object> page(JobQuery query) {
        QueryWrapper<Job> wrapper = new QueryWrapper<>();
        buildWrapper(wrapper, query);

        // 排序
        if ("deadline".equals(query.getSort())) {
            // 截止临近优先: 有明确日期的在前, 按日期升序
            wrapper.orderByAsc("ISNULL(deadline_date)");
            wrapper.orderByAsc("deadline_date");
            wrapper.orderByDesc("publish_date");
        } else {
            // 默认: 最新发布优先
            wrapper.orderByDesc("publish_date");
            wrapper.orderByDesc("id");
        }

        // 分页
        int current = query.getPage() == null || query.getPage() < 1 ? 1 : query.getPage();
        int size = query.getSize() == null || query.getSize() < 1 ? 20 : Math.min(query.getSize(), 100);
        Page<Job> page = jobMapper.selectPage(new Page<>(current, size), wrapper);

        return buildPageResult(page);
    }

    /**
     * 按公司聚合分页: 每家公司一条, 附带在招岗位数
     */
    public Map<String, Object> pageByCompany(JobQuery query) {
        QueryWrapper<Job> wrapper = new QueryWrapper<>();
        buildWrapper(wrapper, query);

        wrapper.select(
                "company_name",
                "COUNT(*) AS job_count",
                "MAX(publish_date) AS latest_publish_date",
                "MAX(company_nature) AS company_nature",
                "MAX(deadline_date) AS latest_deadline_date",
                "GROUP_CONCAT(DISTINCT industry SEPARATOR ',') AS industries",
                "GROUP_CONCAT(DISTINCT cities SEPARATOR ',') AS cities",
                "GROUP_CONCAT(DISTINCT positions SEPARATOR '|') AS positions");
        wrapper.groupBy("company_name");
        wrapper.orderByDesc("MAX(publish_date)");
        wrapper.orderByDesc("job_count");

        int current = query.getPage() == null || query.getPage() < 1 ? 1 : query.getPage();
        int size = query.getSize() == null || query.getSize() < 1 ? 20 : Math.min(query.getSize(), 100);
        Page<Map<String, Object>> page = jobMapper.selectMapsPage(new Page<>(current, size), wrapper);

        Map<String, Object> result = new HashMap<>();
        result.put("total", page.getTotal());
        result.put("pages", page.getPages());
        result.put("current", page.getCurrent());
        result.put("size", page.getSize());
        result.put("records", page.getRecords());

        // 当前筛选条件下的最新发布时间 + 新增条数
        QueryWrapper<Job> statWrapper = new QueryWrapper<>();
        buildWrapper(statWrapper, query);
        statWrapper.select("publish_date").orderByDesc("publish_date").last("LIMIT 1");
        Job latest = jobMapper.selectOne(statWrapper);
        if (latest != null && latest.getPublishDate() != null) {
            result.put("latestUpdate", latest.getPublishDate());
            QueryWrapper<Job> countWrapper = new QueryWrapper<>();
            buildWrapper(countWrapper, query);
            countWrapper.eq("publish_date", latest.getPublishDate());
            result.put("latestCount", jobMapper.selectCount(countWrapper));
        } else {
            result.put("latestUpdate", null);
            result.put("latestCount", 0);
        }
        return result;
    }

    /**
     * 构建通用筛选条件(岗位列表与公司聚合复用)
     */
    private void buildWrapper(QueryWrapper<Job> wrapper, JobQuery query) {
        // 关键字: 公司名/岗位模糊匹配
        if (StringUtils.hasText(query.getKeyword())) {
            String kw = query.getKeyword().trim();
            wrapper.and(w -> w.like("company_name", kw).or().like("positions", kw));
        }
        // 公司名精确匹配(查某公司全部岗位)
        if (StringUtils.hasText(query.getCompanyName())) {
            wrapper.eq("company_name", query.getCompanyName());
        }
        // 招聘类型多选
        applyFindInSet(wrapper, query.getRecruitType(), "recruit_types");
        // 企业性质多选
        applyFindInSet(wrapper, query.getNature(), "company_nature");
        // 行业多选
        applyFindInSet(wrapper, query.getIndustry(), "industry");
        // 城市多选
        applyFindInSet(wrapper, query.getCity(), "cities");
        // 届别: 区间命中
        if (query.getGrade() != null) {
            wrapper.apply("grade_min IS NOT NULL AND grade_min <= {0} AND grade_max >= {0}", query.getGrade());
        }
        // 学历
        if (StringUtils.hasText(query.getEducation()) && !"不限".equals(query.getEducation())) {
            wrapper.eq("education", query.getEducation());
        }
        // 小程序端只查上架岗位
        wrapper.eq("status", 1);
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

    /**
     * 岗位详情(仅上架)
     */
    public Job detail(Long id) {
        return jobMapper.selectOne(
                new QueryWrapper<Job>().eq("id", id).eq("status", 1));
    }

    /**
     * 筛选项字典
     */
    public Map<String, Object> meta() {
        Map<String, Object> meta = new HashMap<>();
        meta.put("industries", INDUSTRIES);
        meta.put("recruitTypes", RECRUIT_TYPES);
        meta.put("natures", NATURES);
        meta.put("educations", EDUCATIONS);
        meta.put("provinces", buildProvinces());
        meta.put("specialCities", ProvinceCity.SPECIAL_CITIES);
        meta.put("grades", Arrays.asList(28, 27, 26, 25, 24));
        // 全局最新发布时间(上架岗位) + 最新日期的条数
        Job latest = jobMapper.selectOne(
                new QueryWrapper<Job>().select("publish_date").eq("status", 1)
                        .orderByDesc("publish_date").last("LIMIT 1"));
        meta.put("latestUpdate", latest != null ? latest.getPublishDate() : null);
        if (latest != null && latest.getPublishDate() != null) {
            LocalDate latestDate = latest.getPublishDate();
            LocalDate weekAgo = latestDate.minusDays(6);
            Long recentCount = jobMapper.selectCount(
                    new QueryWrapper<Job>().eq("status", 1)
                            .ge("publish_date", weekAgo)
                            .le("publish_date", latestDate));
            meta.put("recentCount", recentCount);
        } else {
            meta.put("recentCount", 0);
        }
        return meta;
    }

    /**
     * 省-市结构(用于前端城市二级筛选)
     */
    private List<Map<String, Object>> buildProvinces() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, List<String>> e : ProvinceCity.PROVINCE_CITY.entrySet()) {
            Map<String, Object> p = new HashMap<>();
            p.put("name", e.getKey());
            p.put("cities", e.getValue());
            result.add(p);
        }
        return result;
    }

    /**
     * 多值字段 FIND_IN_SET 多选: 逗号分隔的值, OR 连接
     */
    private void applyFindInSet(QueryWrapper<Job> wrapper, String value, String column) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        String[] values = Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toArray(String[]::new);
        if (values.length == 0) {
            return;
        }
        wrapper.and(w -> {
            for (int i = 0; i < values.length; i++) {
                if (i > 0) {
                    w.or();
                }
                w.apply("FIND_IN_SET({0}, " + column + ")", values[i]);
            }
        });
    }
}
