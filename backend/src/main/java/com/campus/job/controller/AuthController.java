package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.dto.LoginRequest;
import com.campus.job.dto.LoginResponse;
import com.campus.job.dto.RegisterRequest;
import com.campus.job.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public Result<LoginResponse> login(@RequestBody LoginRequest request) {
        return Result.ok(authService.login(request));
    }

    @PostMapping("/register")
    public Result<LoginResponse> register(@RequestBody RegisterRequest request) {
        return Result.ok(authService.register(request));
    }

    @PostMapping("/password-login")
    public Result<LoginResponse> passwordLogin(@RequestBody Map<String, String> body) {
        return Result.ok(authService.passwordLogin(body.get("phone"), body.get("password")));
    }
}
