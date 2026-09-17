package com.campus.job.controller;

import com.campus.job.common.BusinessException;
import com.campus.job.common.Result;
import com.campus.job.dto.JobQuery;
import com.campus.job.entity.Job;
import com.campus.job.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @GetMapping
    public Result<Map<String, Object>> page(JobQuery query) {
        return Result.ok(jobService.page(query));
    }

    @GetMapping("/{id}")
    public Result<Job> detail(@PathVariable Long id) {
        Job job = jobService.detail(id);
        if (job == null) {
            throw new BusinessException(404, "岗位不存在");
        }
        return Result.ok(job);
    }
}
