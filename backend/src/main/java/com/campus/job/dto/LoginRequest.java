package com.campus.job.dto;

import lombok.Data;

/**
 * 登录请求
 */
@Data
public class LoginRequest {

    /** 微信登录凭证 code */
    private String code;

    /** 昵称(可选) */
    private String nickname;

    /** 头像(可选) */
    private String avatar;
}
