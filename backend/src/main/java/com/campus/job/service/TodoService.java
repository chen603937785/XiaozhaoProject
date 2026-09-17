package com.campus.job.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.job.common.BusinessException;
import com.campus.job.common.UserContext;
import com.campus.job.entity.Job;
import com.campus.job.entity.JobStatus;
import com.campus.job.entity.Plan;
import com.campus.job.entity.Todo;
import com.campus.job.mapper.JobMapper;
import com.campus.job.mapper.JobStatusMapper;
import com.campus.job.mapper.PlanMapper;
import com.campus.job.mapper.TodoMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 待办服务：手动待办 + 系统自动生成（岗位截止提醒）+ 按计划筛选
 */
@Service
@RequiredArgsConstructor
public class TodoService {

    private final TodoMapper todoMapper;
    private final JobStatusMapper jobStatusMapper;
    private final JobMapper jobMapper;
    private final PlanMapper planMapper;

    private Long userId() {
        Long uid = UserContext.getUserId();
        if (uid == null) {
            throw new BusinessException(401, "未登录");
        }
        return uid;
    }

    // ===== 列表（含自动生成） =====

    public List<Map<String, Object>> list(Long planId) {
        Long uid = userId();
        syncSystemTodos(uid, planId);
        syncExpectedStartTodos(uid, planId);

        LambdaQueryWrapper<Todo> wrapper = new LambdaQueryWrapper<Todo>()
                .eq(Todo::getUserId, uid);
        if (planId != null) {
            wrapper.eq(Todo::getPlanId, planId);
        }
        wrapper.orderByDesc(Todo::getCreatedAt);
        List<Todo> todos = todoMapper.selectList(wrapper);

        // 关联岗位/计划信息
        List<Long> jobIds = todos.stream().map(Todo::getJobId).filter(j -> j != null).distinct().collect(Collectors.toList());
        List<Long> planIds = todos.stream().map(Todo::getPlanId).filter(p -> p != null).distinct().collect(Collectors.toList());
        Map<Long, Job> jobMap = jobIds.isEmpty() ? new HashMap<>() : jobMapper.selectBatchIds(jobIds).stream()
                .collect(Collectors.toMap(Job::getId, j -> j));
        Map<Long, Plan> planMap = planIds.isEmpty() ? new HashMap<>() : planMapper.selectBatchIds(planIds).stream()
                .collect(Collectors.toMap(Plan::getId, p -> p));

        List<Map<String, Object>> result = new ArrayList<>();
        for (Todo t : todos) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", t.getId());
            m.put("title", t.getTitle());
            m.put("description", t.getDescription());
            m.put("todoType", t.getTodoType());
            m.put("priority", t.getPriority());
            m.put("status", t.getStatus());
            m.put("dueAt", t.getDueAt());
            m.put("source", t.getSource());
            m.put("planId", t.getPlanId());
            m.put("jobId", t.getJobId());
            m.put("completedAt", t.getCompletedAt());
            Job job = t.getJobId() == null ? null : jobMap.get(t.getJobId());
            if (job != null) {
                m.put("companyName", job.getCompanyName());
                m.put("jobTitle", firstOf(job.getPositions()));
            }
            Plan plan = t.getPlanId() == null ? null : planMap.get(t.getPlanId());
            if (plan != null) {
                m.put("planName", plan.getPlanName());
            }
            result.add(m);
        }
        return result;
    }

    /** 自动生成：岗位截止提醒（3 天内截止且未投递的意向/准备投递岗位） */
    private void syncSystemTodos(Long uid, Long planId) {
        LambdaQueryWrapper<JobStatus> wrapper = new LambdaQueryWrapper<JobStatus>()
                .eq(JobStatus::getUserId, uid)
                .in(JobStatus::getMainStatus, "TO_EVALUATE", "PREPARING");
        if (planId != null) {
            wrapper.eq(JobStatus::getPlanId, planId);
        }
        List<JobStatus> statuses = jobStatusMapper.selectList(wrapper);
        if (statuses.isEmpty()) return;

        List<Long> jobIds = statuses.stream().map(JobStatus::getJobId).distinct().collect(Collectors.toList());
        Map<Long, Job> jobMap = jobMapper.selectBatchIds(jobIds).stream()
                .collect(Collectors.toMap(Job::getId, j -> j));
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        for (JobStatus s : statuses) {
            Job job = jobMap.get(s.getJobId());
            if (job == null || job.getDeadlineDate() == null) continue;
            LocalDate dd = job.getDeadlineDate();
            long daysLeft = ChronoUnit.DAYS.between(today, dd);
            if (daysLeft > 3) continue;
            // 去重：同岗位同类系统待办未完成只保留一条
            Long exists = todoMapper.selectCount(new LambdaQueryWrapper<Todo>()
                    .eq(Todo::getUserId, uid).eq(Todo::getJobId, job.getId())
                    .eq(Todo::getSource, "SYSTEM").eq(Todo::getTodoType, "APPLICATION")
                    .eq(Todo::getStatus, "PENDING"));
            if (exists != null && exists > 0) continue;

            Todo t = new Todo();
            t.setUserId(uid);
            t.setPlanId(s.getPlanId());
            t.setJobId(job.getId());
            t.setTitle("完成「" + job.getCompanyName() + "」岗位投递");
            t.setTodoType("APPLICATION");
            t.setPriority(daysLeft <= 1 ? "URGENT" : "IMPORTANT");
            t.setStatus("PENDING");
            t.setDueAt(dd.atTime(18, 0));
            t.setSource("SYSTEM");
            t.setCreatedAt(now);
            t.setUpdatedAt(now);
            todoMapper.insert(t);
        }
    }

    /** 自动生成：预计开始时间提醒（按岗位状态/子状态生成对应任务） */
    private void syncExpectedStartTodos(Long uid, Long planId) {
        LambdaQueryWrapper<JobStatus> wrapper = new LambdaQueryWrapper<JobStatus>()
                .eq(JobStatus::getUserId, uid)
                .isNotNull(JobStatus::getExpectedStartAt)
                .ne(JobStatus::getMainStatus, "CLOSED");
        if (planId != null) {
            wrapper.eq(JobStatus::getPlanId, planId);
        }
        List<JobStatus> statuses = jobStatusMapper.selectList(wrapper);
        if (statuses.isEmpty()) return;

        List<Long> jobIds = statuses.stream().map(JobStatus::getJobId).distinct().collect(Collectors.toList());
        Map<Long, Job> jobMap = jobMapper.selectBatchIds(jobIds).stream()
                .collect(Collectors.toMap(Job::getId, j -> j));
        LocalDateTime now = LocalDateTime.now();

        for (JobStatus s : statuses) {
            Job job = jobMap.get(s.getJobId());
            if (job == null || s.getExpectedStartAt() == null) continue;
            LocalDateTime due = s.getExpectedStartAt();
            // 查该岗位已有的预计开始时间提醒（含已完成，避免完成后再生成新的一条）
            List<Todo> existingList = todoMapper.selectList(new LambdaQueryWrapper<Todo>()
                    .eq(Todo::getUserId, uid).eq(Todo::getJobId, job.getId())
                    .eq(Todo::getSource, "SYSTEM")
                    .eq(Todo::getDescription, "EXPECTED_START"));
            boolean hasMatch = false;
            for (Todo e : existingList) {
                if (java.util.Objects.equals(e.getDueAt(), due)) {
                    hasMatch = true;
                } else {
                    todoMapper.deleteById(e.getId());
                }
            }
            if (hasMatch) continue;

            Todo t = new Todo();
            t.setUserId(uid);
            t.setPlanId(s.getPlanId());
            t.setJobId(job.getId());
            t.setTitle(expectedTitle(s.getMainStatus(), job.getCompanyName()));
            t.setTodoType(expectedType(s.getMainStatus()));
            t.setPriority("NORMAL");
            t.setStatus("PENDING");
            t.setDueAt(due);
            t.setSource("SYSTEM");
            t.setDescription("EXPECTED_START");
            t.setCreatedAt(now);
            t.setUpdatedAt(now);
            todoMapper.insert(t);
        }
    }

    private String expectedTitle(String status, String company) {
        switch (status) {
            case "TO_EVALUATE": return "开始准备「" + company + "」岗位";
            case "PREPARING": return "开始投递「" + company + "」岗位";
            case "APPLIED": return "跟进「" + company + "」投递结果";
            case "ASSESSMENT": return "参加「" + company + "」笔试";
            case "INTERVIEW": return "参加「" + company + "」面试";
            case "OFFER": return "确认「" + company + "」Offer";
            default: return "处理「" + company + "」岗位";
        }
    }

    private String expectedType(String status) {
        switch (status) {
            case "ASSESSMENT": return "ASSESSMENT";
            case "INTERVIEW": return "INTERVIEW";
            case "OFFER": return "FOLLOW_UP";
            default: return "APPLICATION";
        }
    }

    // ===== 创建 / 编辑 / 删除 =====

    @Transactional
    public Long create(Map<String, Object> body) {
        Long uid = userId();
        String title = body.get("title") == null ? "" : String.valueOf(body.get("title"));
        if (!StringUtils.hasText(title)) {
            throw new BusinessException(400, "待办名称不能为空");
        }
        Todo t = new Todo();
        t.setUserId(uid);
        t.setTitle(title.trim());
        applyBody(t, body);
        t.setStatus("PENDING");
        t.setSource("USER");
        t.setTodoType(body.get("todoType") == null ? "CUSTOM" : String.valueOf(body.get("todoType")));
        LocalDateTime now = LocalDateTime.now();
        t.setCreatedAt(now);
        t.setUpdatedAt(now);
        todoMapper.insert(t);
        return t.getId();
    }

    @Transactional
    public void update(Long id, Map<String, Object> body) {
        Long uid = userId();
        Todo t = todoMapper.selectOne(new LambdaQueryWrapper<Todo>()
                .eq(Todo::getUserId, uid).eq(Todo::getId, id));
        if (t == null) throw new BusinessException(404, "待办不存在");
        if (body.get("title") != null && StringUtils.hasText(String.valueOf(body.get("title")))) {
            t.setTitle(String.valueOf(body.get("title")).trim());
        }
        if (body.get("todoType") != null) t.setTodoType(String.valueOf(body.get("todoType")));
        applyBody(t, body);
        // 状态变更
        if (body.get("status") != null) {
            String status = String.valueOf(body.get("status"));
            t.setStatus(status);
            if ("COMPLETED".equals(status)) {
                t.setCompletedAt(LocalDateTime.now());
            } else {
                t.setCompletedAt(null);
            }
        }
        t.setUpdatedAt(LocalDateTime.now());
        todoMapper.updateById(t);
    }

    @Transactional
    public void delete(Long id) {
        Long uid = userId();
        todoMapper.delete(new LambdaQueryWrapper<Todo>()
                .eq(Todo::getUserId, uid).eq(Todo::getId, id));
    }

    private void applyBody(Todo t, Map<String, Object> body) {
        if (body.get("description") != null) t.setDescription(String.valueOf(body.get("description")));
        if (body.get("priority") != null) t.setPriority(String.valueOf(body.get("priority")));
        if (body.get("planId") != null) t.setPlanId(toLong(body.get("planId")));
        if (body.get("jobId") != null) t.setJobId(toLong(body.get("jobId")));
        if (body.get("dueAt") != null) t.setDueAt(parseDateTime(String.valueOf(body.get("dueAt"))));
    }

    private Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        try { return Long.parseLong(String.valueOf(o)); } catch (Exception e) { return null; }
    }

    private LocalDateTime parseDateTime(String s) {
        if (!StringUtils.hasText(s)) return null;
        try {
            return LocalDateTime.parse(s);
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(s, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            } catch (Exception e2) {
                try {
                    return LocalDateTime.parse(s, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
                } catch (Exception e3) {
                    return null;
                }
            }
        }
    }

    private String firstOf(String str) {
        if (str == null) return null;
        String[] arr = str.split(",");
        return arr.length > 0 ? arr[0].trim() : str;
    }
}
