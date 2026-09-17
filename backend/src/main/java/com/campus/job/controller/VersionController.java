package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.service.ConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 客户端版本更新公开接口（无需登录）
 */
@RestController
@RequestMapping("/api/version")
@RequiredArgsConstructor
public class VersionController {

    private final ConfigService configService;

    @GetMapping("/latest")
    public Result<Map<String, Object>> latest() {
        return Result.ok(configService.versionInfo());
    }
}
