package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户岗位跟进状态
 */
@Data
@TableName("job_status")
public class JobStatus {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long jobId;

    /** 主状态: TO_EVALUATE/PREPARING/APPLIED/ASSESSMENT/INTERVIEW/OFFER/CLOSED */
    private String mainStatus;

    private String subStatus;

    private String statusReason;

    private Integer favorite;

    private Integer priority;

    private Long planId;

    private LocalDateTime appliedAt;

    private LocalDateTime assessmentAt;

    private LocalDateTime interviewAt;

    private LocalDateTime offerDeadline;

    /** 预计开始时间（用户自定义） */
    private LocalDateTime expectedStartAt;

    private String notes;

    private LocalDateTime statusChangedAt;

    private LocalDateTime statusCreatedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
