package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("redeem_record")
public class RedeemRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String code;

    private Long userId;

    private String planType;

    private Integer days;

    private LocalDateTime redeemedAt;
}
