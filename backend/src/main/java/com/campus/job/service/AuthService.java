package com.campus.job.service;

import cn.hutool.crypto.SecureUtil;
import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.job.common.BusinessException;
import com.campus.job.common.JwtUtil;
import com.campus.job.dto.LoginRequest;
import com.campus.job.dto.LoginResponse;
import com.campus.job.dto.RegisterRequest;
import com.campus.job.entity.User;
import com.campus.job.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 认证服务
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;

    @Value("${wechat.appid}")
    private String appid;

    @Value("${wechat.secret}")
    private String secret;

    @Value("${wechat.mock-openid}")
    private Boolean mockOpenid;

    private static final String CODE2SESSION_URL =
            "https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code";

    /**
     * 微信登录: code 换 openid, 查找或创建用户, 返回 token
     */
    public LoginResponse login(LoginRequest request) {
        String openid;
        if (Boolean.TRUE.equals(mockOpenid)) {
            // 开发模式: 固定 mock openid, 保证用户数据(手机号/偏好)持久
            openid = "mock_user";
        } else {
            if (!StringUtils.hasText(request.getCode())) {
                throw new BusinessException(400, "缺少登录凭证 code");
            }
            openid = code2session(request.getCode());
        }

        // 查找或创建用户
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getOpenid, openid));
        if (user == null) {
            user = new User();
            user.setOpenid(openid);
            user.setNickname(request.getNickname());
            user.setAvatar(request.getAvatar());
            userMapper.insert(user);
        } else if (StringUtils.hasText(request.getNickname())) {
            // 更新昵称头像
            user.setNickname(request.getNickname());
            user.setAvatar(request.getAvatar());
            userMapper.updateById(user);
        }

        String token = jwtUtil.createToken(user.getId(), openid);
        return new LoginResponse(token, user.getId(), user.getPhone());
    }

    /**
     * 注册(手机号+密码)
     */
    public LoginResponse register(RegisterRequest request) {
        String phone = request.getPhone();
        if (phone == null || !phone.matches("^1\\d{10}$")) {
            throw new BusinessException(400, "手机号格式不正确");
        }
        if (!StringUtils.hasText(request.getPassword()) || request.getPassword().length() < 6) {
            throw new BusinessException(400, "密码至少 6 位");
        }
        User existing = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getPhone, phone));
        if (existing != null) {
            throw new BusinessException(400, "该手机号已注册，请直接登录");
        }
        User user = new User();
        user.setPhone(phone);
        user.setPassword(SecureUtil.md5(request.getPassword()));
        userMapper.insert(user);
        String token = jwtUtil.createToken(user.getId(), phone);
        return new LoginResponse(token, user.getId(), phone);
    }

    /**
     * 密码登录(手机号+密码)
     */
    public LoginResponse passwordLogin(String phone, String password) {
        if (!StringUtils.hasText(phone) || !StringUtils.hasText(password)) {
            throw new BusinessException(400, "请输入手机号和密码");
        }
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getPhone, phone));
        if (user == null || !SecureUtil.md5(password).equals(user.getPassword())) {
            throw new BusinessException(400, "手机号或密码错误");
        }
        String token = jwtUtil.createToken(user.getId(), phone);
        return new LoginResponse(token, user.getId(), user.getPhone());
    }

    /**
     * 调用微信 jscode2session 换取 openid
     */
    private String code2session(String code) {
        String url = String.format(CODE2SESSION_URL, appid, secret, code);
        String resp = HttpUtil.get(url);
        JSONObject json = JSONUtil.parseObj(resp);
        String openid = json.getStr("openid");
        if (!StringUtils.hasText(openid)) {
            Integer errcode = json.getInt("errcode");
            throw new BusinessException(400, "微信登录失败: " + errcode + " " + json.getStr("errmsg"));
        }
        return openid;
    }
}
