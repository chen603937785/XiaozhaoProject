package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户实体
 */
@Data
@TableName("app_user")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 微信openid */
    private String openid;

    /** 昵称 */
    private String nickname;

    /** 头像 */
    private String avatar;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 岗位偏好(JSON, 筛选项) */
    private String preference;

    /** 手机号(用户手动输入绑定) */
    private String phone;

    /** 密码(注册/密码登录用) */
    private String password;

    /** 简历信息(JSON, 字段名->值) */
    private String resume;

    /** 是否会员(1=是,0=否) */
    private Integer isVip;

    /** 会员到期时间 */
    private LocalDateTime vipExpire;
}
