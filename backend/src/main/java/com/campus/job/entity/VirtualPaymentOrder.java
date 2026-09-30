package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("virtual_payment_order")
public class VirtualPaymentOrder {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String outTradeNo;
    private String wxOrderId;
    private Long userId;
    private String openid;
    private String productId;
    private String planType;
    private Integer goodsPrice;
    private Integer quantity;
    private Integer durationDays;
    private Boolean reported;
    private LocalDateTime lastCheckedAt;
    private String attach;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime paidAt;
    private LocalDateTime deliveredAt;
}
