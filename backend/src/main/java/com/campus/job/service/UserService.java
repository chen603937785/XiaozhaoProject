package com.campus.job.service;

import cn.hutool.json.JSONUtil;
import com.campus.job.common.BusinessException;
import com.campus.job.common.UserContext;
import com.campus.job.entity.User;
import com.campus.job.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.Map;

/**
 * 用户服务
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;

    /**
     * 获取当前用户偏好
     */
    public Map<String, Object> getPreference() {
        User user = currentUser();
        if (user == null || !StringUtils.hasText(user.getPreference())) {
            return new HashMap<>();
        }
        try {
            return JSONUtil.parseObj(user.getPreference());
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    /**
     * 保存当前用户偏好
     */
    public void savePreference(Map<String, Object> preference) {
        User user = currentUser();
        if (user == null) {
            throw new BusinessException(401, "未登录");
        }
        User update = new User();
        update.setId(user.getId());
        update.setPreference(JSONUtil.toJsonStr(preference == null ? new HashMap<>() : preference));
        userMapper.updateById(update);
    }

    private User currentUser() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            return null;
        }
        return userMapper.selectById(userId);
    }

    /**
     * 绑定手机号(用户手动输入, 校验合法性)
     */
    public void bindPhone(String phone) {
        if (phone == null || !phone.matches("^1\\d{10}$")) {
            throw new BusinessException(400, "手机号格式不正确");
        }
        User user = currentUser();
        if (user == null) {
            throw new BusinessException(401, "未登录");
        }
        User update = new User();
        update.setId(user.getId());
        update.setPhone(phone);
        userMapper.updateById(update);
    }

    /**
     * 获取当前用户简历
     */
    public Map<String, Object> getResume() {
        User user = currentUser();
        if (user == null || !StringUtils.hasText(user.getResume())) {
            return new HashMap<>();
        }
        try {
            return JSONUtil.parseObj(user.getResume());
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    /**
     * 保存当前用户简历
     */
    public void saveResume(Map<String, Object> resume) {
        User user = currentUser();
        if (user == null) {
            throw new BusinessException(401, "未登录");
        }
        User update = new User();
        update.setId(user.getId());
        update.setResume(JSONUtil.toJsonStr(resume == null ? new HashMap<>() : resume));
        userMapper.updateById(update);
    }

    /**
     * 获取当前用户信息
     */
    public Map<String, Object> info() {
        User user = currentUser();
        if (user == null) {
            throw new BusinessException(401, "未登录");
        }
        Map<String, Object> info = new HashMap<>();
        info.put("userId", user.getId());
        info.put("nickname", user.getNickname());
        info.put("phone", user.getPhone());
        info.put("isVip", user.getIsVip() != null && user.getIsVip() == 1);
        info.put("vipExpire", user.getVipExpire());
        info.put("preference", StringUtils.hasText(user.getPreference())
                ? JSONUtil.parseObj(user.getPreference()) : new HashMap<>());
        return info;
    }

    /**
     * 更新昵称
     */
    public void updateNickname(String nickname) {
        User user = currentUser();
        if (user == null) {
            throw new BusinessException(401, "未登录");
        }
        User update = new User();
        update.setId(user.getId());
        update.setNickname(nickname);
        userMapper.updateById(update);
    }
}
