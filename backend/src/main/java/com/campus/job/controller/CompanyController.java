package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.dto.JobQuery;
import com.campus.job.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 公司维度接口: 按公司聚合的岗位列表
 */
@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
public class CompanyController {

    private final JobService jobService;

    @GetMapping
    public Result<Map<String, Object>> page(JobQuery query) {
        return Result.ok(jobService.pageByCompany(query));
    }
}
