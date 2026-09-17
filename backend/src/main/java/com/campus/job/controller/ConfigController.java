package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.service.ConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 小程序公开配置接口
 */
@RestController
@RequestMapping("/api/config")
@RequiredArgsConstructor
public class ConfigController {

    private final ConfigService configService;

    @GetMapping
    public Result<Map<String, Object>> config() {
        return Result.ok(configService.publicConfig());
    }
}
