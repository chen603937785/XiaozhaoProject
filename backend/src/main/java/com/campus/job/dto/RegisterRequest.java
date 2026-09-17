package com.campus.job.dto;

import lombok.Data;

/**
 * 注册请求
 */
@Data
public class RegisterRequest {

    /** 手机号 */
    private String phone;

    /** 密码 */
    private String password;

    /** 推广码(可不填) */
    private String promo;
}
