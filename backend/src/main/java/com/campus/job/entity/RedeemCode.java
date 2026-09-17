package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("redeem_code")
public class RedeemCode {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String code;

    /** MONTH/QUARTER/YEAR */
    private String planType;

    private Integer days;

    /** UNUSED/USED/EXPIRED */
    private String status;

    private Long usedBy;

    private LocalDateTime usedAt;

    private LocalDateTime expiredAt;

    private String remark;

    private LocalDateTime createdAt;
}
