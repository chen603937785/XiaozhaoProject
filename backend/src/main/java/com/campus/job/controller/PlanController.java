package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.service.PlanService;
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
 * 求职计划接口
 */
@RestController
@RequestMapping("/api/plans")
@RequiredArgsConstructor
public class PlanController {

    private final PlanService planService;

    @GetMapping
    public Result<List<Map<String, Object>>> list() {
        return Result.ok(planService.list());
    }

    @PostMapping
    public Result<Long> create(@RequestBody Map<String, Object> body) {
        return Result.ok(planService.create(body));
    }

    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        planService.update(id, body);
        return Result.ok();
    }

    @PostMapping("/{id}/active")
    public Result<Void> setActive(@PathVariable Long id) {
        planService.setActive(id);
        return Result.ok();
    }

    @PostMapping("/{id}/pause")
    public Result<Void> pause(@PathVariable Long id) {
        planService.pause(id);
        return Result.ok();
    }

    @PostMapping("/{id}/complete")
    public Result<Void> complete(@PathVariable Long id) {
        planService.complete(id);
        return Result.ok();
    }

    @PostMapping("/{id}/archive")
    public Result<Void> archive(@PathVariable Long id) {
        planService.archive(id);
        return Result.ok();
    }

    @PostMapping("/{id}/restore")
    public Result<Void> restore(@PathVariable Long id) {
        planService.restore(id);
        return Result.ok();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        planService.delete(id);
        return Result.ok();
    }

    @PostMapping("/move-job")
    public Result<Void> moveJob(@RequestBody Map<String, Object> body) {
        Long jobId = body.get("jobId") == null ? null : Long.valueOf(String.valueOf(body.get("jobId")));
        Long targetPlanId = body.get("targetPlanId") == null ? null : Long.valueOf(String.valueOf(body.get("targetPlanId")));
        Boolean resetStatus = Boolean.TRUE.equals(body.get("resetStatus"));
        planService.moveJob(jobId, targetPlanId, resetStatus);
        return Result.ok();
    }
}
