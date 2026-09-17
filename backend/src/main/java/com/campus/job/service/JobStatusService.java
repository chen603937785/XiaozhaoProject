package com.campus.job.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.campus.job.common.BusinessException;
import com.campus.job.common.UserContext;
import com.campus.job.entity.Job;
import com.campus.job.entity.JobStatus;
import com.campus.job.entity.Plan;
import com.campus.job.entity.StatusHistory;
import com.campus.job.entity.Todo;
import com.campus.job.mapper.JobMapper;
import com.campus.job.mapper.JobStatusMapper;
import com.campus.job.mapper.PlanMapper;
import com.campus.job.mapper.StatusHistoryMapper;
import com.campus.job.mapper.TodoMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 岗位状态服务：关注岗位 + 状态流转 + 求职进度统计
 */
@Service
@RequiredArgsConstructor
public class JobStatusService {

    private final JobStatusMapper jobStatusMapper;
    private final StatusHistoryMapper statusHistoryMapper;
    private final JobMapper jobMapper;
    private final PlanMapper planMapper;
    private final TodoMapper todoMapper;

    private static final String[] STAGE_ORDER = {"TO_EVALUATE", "PREPARING", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER"};
    private static final Map<String, String> STAGE_LABEL = new LinkedHashMap<>();
    static {
        STAGE_LABEL.put("TO_EVALUATE", "意向岗位");
        STAGE_LABEL.put("PREPARING", "准备投递");
        STAGE_LABEL.put("APPLIED", "已投递");
        STAGE_LABEL.put("ASSESSMENT", "笔试");
        STAGE_LABEL.put("INTERVIEW", "面试");
        STAGE_LABEL.put("OFFER", "Offer");
    }

    private Long userId() {
        Long uid = UserContext.getUserId();
        if (uid == null) {
            throw new BusinessException(401, "未登录");
        }
        return uid;
    }

    // ===== 关注/取消 =====

    /** 关注岗位（加入岗位管理，初始状态待评估，归属求职计划） */
    public void follow(Long jobId, Long planId) {
        Long uid = userId();
        JobStatus existing = jobStatusMapper.selectOne(
                new LambdaQueryWrapper<JobStatus>().eq(JobStatus::getUserId, uid).eq(JobStatus::getJobId, jobId));
        if (existing != null) return;
        if (planId == null) {
            Plan active = planMapper.selectOne(new LambdaQueryWrapper<Plan>()
                    .eq(Plan::getUserId, uid).eq(Plan::getStatus, "IN_PROGRESS"));
            planId = active == null ? null : active.getId();
        }
        JobStatus s = new JobStatus();
        s.setUserId(uid);
        s.setJobId(jobId);
        s.setPlanId(planId);
        s.setMainStatus("TO_EVALUATE");
        s.setFavorite(1);
        s.setStatusCreatedAt(LocalDateTime.now());
        s.setStatusChangedAt(LocalDateTime.now());
        jobStatusMapper.insert(s);
    }

    /** 取消关注 */
    public void unfollow(Long jobId) {
        Long uid = userId();
        jobStatusMapper.delete(new LambdaQueryWrapper<JobStatus>()
                .eq(JobStatus::getUserId, uid).eq(JobStatus::getJobId, jobId));
    }

    /** 是否关注 */
    public boolean isFollowed(Long jobId) {
        Long uid = userId();
        return jobStatusMapper.selectCount(new LambdaQueryWrapper<JobStatus>()
                .eq(JobStatus::getUserId, uid).eq(JobStatus::getJobId, jobId)) > 0;
    }

    // ===== 关注列表 =====

    /** 关注岗位列表（按状态/计划筛选，关联岗位信息） */
    public List<Map<String, Object>> list(String status, Long planId) {
        Long uid = userId();
        LambdaQueryWrapper<JobStatus> wrapper = new LambdaQueryWrapper<JobStatus>()
                .eq(JobStatus::getUserId, uid)
                .orderByDesc(JobStatus::getCreatedAt);
        if (StringUtils.hasText(status)) {
            wrapper.eq(JobStatus::getMainStatus, status);
        }
        if (planId != null) {
            wrapper.eq(JobStatus::getPlanId, planId);
        }
        List<JobStatus> statuses = jobStatusMapper.selectList(wrapper);
        if (statuses.isEmpty()) return new ArrayList<>();

        List<Long> jobIds = statuses.stream().map(JobStatus::getJobId).collect(Collectors.toList());
        Map<Long, Job> jobMap = jobMapper.selectBatchIds(jobIds).stream()
                .collect(Collectors.toMap(Job::getId, j -> j));

        List<Map<String, Object>> result = new ArrayList<>();
        for (JobStatus s : statuses) {
            Job job = jobMap.get(s.getJobId());
            if (job == null) continue;
            Map<String, Object> m = new HashMap<>();
            m.put("jobId", job.getId());
            m.put("companyName", job.getCompanyName());
            m.put("positions", job.getPositions());
            m.put("industry", job.getIndustry());
            m.put("cities", job.getCities());
            m.put("companyNature", job.getCompanyNature());
            m.put("recruitTypes", job.getRecruitTypes());
            m.put("publishDate", job.getPublishDate());
            m.put("deadline", job.getDeadline());
            m.put("deadlineDate", job.getDeadlineDate());
            m.put("noticeUrl", job.getNoticeUrl());
            m.put("applyUrl", job.getApplyUrl());
            m.put("mainStatus", s.getMainStatus());
            m.put("subStatus", s.getSubStatus());
            m.put("statusReason", s.getStatusReason());
            m.put("planId", s.getPlanId());
            m.put("gradeMin", job.getGradeMin());
            m.put("gradeMax", job.getGradeMax());
            m.put("expectedStartAt", s.getExpectedStartAt());
            m.put("statusChangedAt", s.getStatusChangedAt());
            result.add(m);
        }
        return result;
    }

    // ===== 状态流转 =====

    /** 流转岗位状态（修改主状态 + 记录历史） */
    public void updateStatus(Long jobId, String mainStatus, String subStatus, String reason) {
        Long uid = userId();
        if (!StringUtils.hasText(mainStatus)) {
            throw new BusinessException(400, "状态不能为空");
        }
        JobStatus s = jobStatusMapper.selectOne(
                new LambdaQueryWrapper<JobStatus>().eq(JobStatus::getUserId, uid).eq(JobStatus::getJobId, jobId));
        LocalDateTime now = LocalDateTime.now();
        if (s == null) {
            s = new JobStatus();
            s.setUserId(uid);
            s.setJobId(jobId);
            s.setMainStatus(mainStatus);
            s.setSubStatus(subStatus);
            s.setFavorite(1);
            s.setStatusCreatedAt(now);
            s.setStatusChangedAt(now);
            if ("CLOSED".equals(mainStatus)) {
                s.setStatusReason(reason);
            }
            jobStatusMapper.insert(s);
            return;
        }
        String fromStatus = s.getMainStatus();
        String fromSub = s.getSubStatus();
        if (mainStatus.equals(fromStatus) && java.util.Objects.equals(subStatus, fromSub)) {
            return; // 状态没变
        }
        // 记录历史
        StatusHistory h = new StatusHistory();
        h.setUserId(uid);
        h.setJobId(jobId);
        h.setFromStatus(fromStatus);
        h.setToStatus(mainStatus);
        h.setFromSubStatus(fromSub);
        h.setToSubStatus(subStatus);
        h.setReason(reason);
        h.setOperator("user");
        statusHistoryMapper.insert(h);
        // 更新状态
        s.setMainStatus(mainStatus);
        s.setSubStatus(subStatus);
        s.setStatusChangedAt(now);
        if ("CLOSED".equals(mainStatus)) {
            s.setStatusReason(reason);
        } else {
            s.setStatusReason(null);
        }
        if (!mainStatus.equals(fromStatus)) {
            s.setStatusCreatedAt(now);
        }
        jobStatusMapper.updateById(s);
    }

    /** 设置预计开始时间 */
    public void updateExpectedStart(Long jobId, String expectedStartAt) {
        Long uid = userId();
        JobStatus s = jobStatusMapper.selectOne(
                new LambdaQueryWrapper<JobStatus>().eq(JobStatus::getUserId, uid).eq(JobStatus::getJobId, jobId));
        if (s == null) throw new BusinessException(404, "该岗位尚未关注");
        LocalDateTime val = null;
        if (StringUtils.hasText(expectedStartAt)) {
            try {
                val = LocalDateTime.parse(expectedStartAt);
            } catch (Exception e) {
                throw new BusinessException(400, "时间格式错误");
            }
        }
        jobStatusMapper.update(null, new LambdaUpdateWrapper<JobStatus>()
                .eq(JobStatus::getUserId, uid)
                .eq(JobStatus::getJobId, jobId)
                .set(JobStatus::getExpectedStartAt, val));
        // 删除该岗位旧的预计开始时间提醒（设置新值后由待办同步重新生成；清除则不生成）
        todoMapper.delete(new LambdaQueryWrapper<Todo>()
                .eq(Todo::getUserId, uid)
                .eq(Todo::getJobId, jobId)
                .eq(Todo::getSource, "SYSTEM")
                .eq(Todo::getDescription, "EXPECTED_START"));
    }

    // ===== 统计 =====

    /** 求职进度总览统计（可按计划维度） */
    public Map<String, Object> overview(Long planId) {
        Long uid = userId();
        LambdaQueryWrapper<JobStatus> wrapper = new LambdaQueryWrapper<JobStatus>()
                .eq(JobStatus::getUserId, uid);
        if (planId != null) {
            wrapper.eq(JobStatus::getPlanId, planId);
        }
        List<JobStatus> statuses = jobStatusMapper.selectList(wrapper);

        Map<String, Long> stageCount = new HashMap<>();
        Set<Long> appliedJobs = new HashSet<>();
        Set<Long> assessmentJobs = new HashSet<>();
        Set<Long> interviewJobs = new HashSet<>();
        Set<Long> offerJobs = new HashSet<>();
        LocalDateTime weekAgo = LocalDateTime.now().minusDays(7);
        Map<String, Long> weekAdded = new HashMap<>();

        for (JobStatus s : statuses) {
            stageCount.merge(s.getMainStatus(), 1L, Long::sum);
            if (s.getStatusCreatedAt() != null && s.getStatusCreatedAt().isAfter(weekAgo)) {
                weekAdded.merge(s.getMainStatus(), 1L, Long::sum);
            }
            switch (s.getMainStatus()) {
                case "APPLIED": appliedJobs.add(s.getJobId()); break;
                case "ASSESSMENT": assessmentJobs.add(s.getJobId()); break;
                case "INTERVIEW": interviewJobs.add(s.getJobId()); break;
                case "OFFER": offerJobs.add(s.getJobId()); break;
            }
        }

        LambdaQueryWrapper<StatusHistory> historyWrapper = new LambdaQueryWrapper<StatusHistory>()
                .eq(StatusHistory::getUserId, uid);
        if (!statuses.isEmpty()) {
            List<Long> jobIds = statuses.stream().map(JobStatus::getJobId).collect(Collectors.toList());
            historyWrapper.in(StatusHistory::getJobId, jobIds);
        }
        List<StatusHistory> history = statusHistoryMapper.selectList(historyWrapper);
        for (StatusHistory h : history) {
            String to = h.getToStatus();
            if (to == null) continue;
            switch (to) {
                case "APPLIED": appliedJobs.add(h.getJobId()); break;
                case "ASSESSMENT": assessmentJobs.add(h.getJobId()); break;
                case "INTERVIEW": interviewJobs.add(h.getJobId()); break;
                case "OFFER": offerJobs.add(h.getJobId()); break;
            }
        }

        List<Map<String, Object>> stages = new ArrayList<>();
        long total = 0;
        for (String status : STAGE_ORDER) {
            long count = stageCount.getOrDefault(status, 0L);
            total += count;
            Map<String, Object> s = new HashMap<>();
            s.put("status", status);
            s.put("label", STAGE_LABEL.get(status));
            s.put("count", count);
            s.put("this_week_added", weekAdded.getOrDefault(status, 0L));
            s.put("week_over_week", 0);
            stages.add(s);
        }

        long closedTotal = stageCount.getOrDefault("CLOSED", 0L);
        Map<String, Long> closedReason = new HashMap<>();
        for (JobStatus s : statuses) {
            if ("CLOSED".equals(s.getMainStatus()) && s.getStatusReason() != null) {
                closedReason.merge(s.getStatusReason(), 1L, Long::sum);
            }
        }
        Map<String, Object> closed = new HashMap<>();
        closed.put("total", closedTotal);
        closed.put("rejected", closedReason.getOrDefault("简历未通过", 0L)
                + closedReason.getOrDefault("笔试未通过", 0L)
                + closedReason.getOrDefault("面试未通过", 0L));
        closed.put("withdrawn", closedReason.getOrDefault("主动放弃", 0L)
                + closedReason.getOrDefault("已接受其他 Offer", 0L));
        closed.put("expired", closedReason.getOrDefault("岗位已过期", 0L)
                + closedReason.getOrDefault("岗位停止招聘", 0L));
        closed.put("other", closedReason.getOrDefault("其他原因", 0L)
                + closedReason.getOrDefault("重复岗位", 0L)
                + closedReason.getOrDefault("长期无反馈", 0L));

        Map<String, Object> conversion = new HashMap<>();
        conversion.put("applied_to_assessment", percent(assessmentJobs.size(), appliedJobs.size()));
        conversion.put("assessment_to_interview", percent(interviewJobs.size(), assessmentJobs.size()));
        conversion.put("interview_to_offer", percent(offerJobs.size(), interviewJobs.size()));

        Map<String, Object> result = new HashMap<>();
        result.put("period", "2026秋招");
        result.put("total", total);
        result.put("stages", stages);
        result.put("closed", closed);
        result.put("conversion", conversion);
        return result;
    }

    private Object percent(int numerator, int denominator) {
        if (denominator == 0) return null;
        return Math.round(numerator * 1000.0 / denominator) / 10.0;
    }
}
