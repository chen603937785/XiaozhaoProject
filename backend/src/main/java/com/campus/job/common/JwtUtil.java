package com.campus.job.common;

import cn.hutool.jwt.JWT;
import cn.hutool.jwt.JWTUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * JWT 工具类 (基于 hutool, HS256)
 */
@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expire-days}")
    private Integer expireDays;

    /**
     * 生成 token
     */
    public String createToken(Long userId, String openid) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);
        payload.put("openid", openid);
        // 过期时间: 当前毫秒 + 天数
        long expireAt = System.currentTimeMillis() + expireDays * 24L * 3600 * 1000;
        payload.put("exp", expireAt);
        return JWTUtil.createToken(payload, secret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 校验并解析 token, 失败返回 null
     */
    public JWT parse(String token) {
        try {
            if (!JWTUtil.verify(token, secret.getBytes(StandardCharsets.UTF_8))) {
                return null;
            }
            return JWTUtil.parseToken(token);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 从 token 中取 userId
     */
    public Long getUserId(String token) {
        JWT jwt = parse(token);
        if (jwt == null) {
            return null;
        }
        Object userId = jwt.getPayload("userId");
        return userId == null ? null : Long.valueOf(userId.toString());
    }

    /**
     * 生成管理员 token
     */
    public String createAdminToken(String username) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("role", "admin");
        payload.put("username", username);
        long expireAt = System.currentTimeMillis() + expireDays * 24L * 3600 * 1000;
        payload.put("exp", expireAt);
        return JWTUtil.createToken(payload, secret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 判断 token 是否为管理员
     */
    public boolean isAdmin(String token) {
        JWT jwt = parse(token);
        if (jwt == null) {
            return false;
        }
        return "admin".equals(jwt.getPayload("role"));
    }
}
