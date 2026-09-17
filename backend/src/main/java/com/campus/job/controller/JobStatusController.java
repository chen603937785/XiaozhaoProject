package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.service.JobStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 岗位状态接口（关注岗位 + 状态流转）
 */
@RestController
@RequestMapping("/api/job-status")
@RequiredArgsConstructor
public class JobStatusController {

    private final JobStatusService jobStatusService;

    @GetMapping("/overview")
    public Result<Map<String, Object>> overview(@RequestParam(required = false) Long planId) {
        return Result.ok(jobStatusService.overview(planId));
    }

    /** 关注岗位（可选归属求职计划） */
    @PostMapping("/follow")
    public Result<Void> follow(@RequestBody Map<String, Object> body) {
        Long jobId = body.get("jobId") == null ? null : Long.valueOf(String.valueOf(body.get("jobId")));
        Long planId = body.get("planId") == null ? null : Long.valueOf(String.valueOf(body.get("planId")));
        jobStatusService.follow(jobId, planId);
        return Result.ok();
    }

    /** 取消关注 */
    @DeleteMapping("/follow/{jobId}")
    public Result<Void> unfollow(@PathVariable Long jobId) {
        jobStatusService.unfollow(jobId);
        return Result.ok();
    }

    /** 是否关注 */
    @GetMapping("/followed/{jobId}")
    public Result<Map<String, Object>> isFollowed(@PathVariable Long jobId) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("followed", jobStatusService.isFollowed(jobId));
        return Result.ok(m);
    }

    /** 关注列表（按状态/计划筛选） */
    @GetMapping("/list")
    public Result<List<Map<String, Object>>> list(@RequestParam(required = false) String status,
                                                  @RequestParam(required = false) Long planId) {
        return Result.ok(jobStatusService.list(status, planId));
    }

    /** 流转状态 */
    @PutMapping("/{jobId}/status")
    public Result<Void> updateStatus(@PathVariable Long jobId, @RequestBody Map<String, String> body) {
        jobStatusService.updateStatus(jobId, body.get("mainStatus"), body.get("subStatus"), body.get("reason"));
        return Result.ok();
    }

    /** 设置预计开始时间 */
    @PutMapping("/{jobId}/expected-start")
    public Result<Void> updateExpectedStart(@PathVariable Long jobId, @RequestBody Map<String, String> body) {
        jobStatusService.updateExpectedStart(jobId, body.get("expectedStartAt"));
        return Result.ok();
    }
}
