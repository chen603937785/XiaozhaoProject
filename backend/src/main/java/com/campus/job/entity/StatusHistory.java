package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 岗位状态历史
 */
@Data
@TableName("status_history")
public class StatusHistory {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long jobId;

    private String fromStatus;

    private String toStatus;

    private String fromSubStatus;

    private String toSubStatus;

    private String reason;

    private String operator;

    private String remark;

    private LocalDateTime createdAt;
}
