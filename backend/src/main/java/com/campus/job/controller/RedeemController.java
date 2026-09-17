package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.service.RedeemService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 兑换码（用户端，需登录）
 */
@RestController
@RequestMapping("/api/redeem")
@RequiredArgsConstructor
public class RedeemController {

    private final RedeemService redeemService;

    @PostMapping
    public Result<Map<String, Object>> redeem(@RequestBody Map<String, String> body) {
        return Result.ok(redeemService.redeem(body.get("code")));
    }
}
