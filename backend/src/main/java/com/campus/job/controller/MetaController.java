package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/meta")
@RequiredArgsConstructor
public class MetaController {

    private final JobService jobService;

    @GetMapping("/filters")
    public Result<Map<String, Object>> filters() {
        return Result.ok(jobService.meta());
    }
}
