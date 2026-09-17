package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 用户接口(需登录)
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/preference")
    public Result<Map<String, Object>> getPreference() {
        return Result.ok(userService.getPreference());
    }

    @PostMapping("/preference")
    public Result<Void> savePreference(@RequestBody Map<String, Object> preference) {
        userService.savePreference(preference);
        return Result.ok();
    }

    @PostMapping("/bind-phone")
    public Result<Void> bindPhone(@RequestBody Map<String, String> body) {
        userService.bindPhone(body.get("phone"));
        return Result.ok();
    }

    @GetMapping("/info")
    public Result<Map<String, Object>> info() {
        return Result.ok(userService.info());
    }

    @PostMapping("/nickname")
    public Result<Void> updateNickname(@RequestBody Map<String, String> body) {
        userService.updateNickname(body.get("nickname"));
        return Result.ok();
    }

    @GetMapping("/resume")
    public Result<Map<String, Object>> getResume() {
        return Result.ok(userService.getResume());
    }

    @PostMapping("/resume")
    public Result<Void> saveResume(@RequestBody Map<String, Object> resume) {
        userService.saveResume(resume);
        return Result.ok();
    }
}
