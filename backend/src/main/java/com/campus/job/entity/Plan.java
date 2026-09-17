package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 求职计划
 */
@Data
@TableName("plan")
public class Plan {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** 计划名称 */
    private String planName;

    /** 招聘阶段（如 2026秋招） */
    private String recruitmentStage;

    private LocalDate startDate;

    private LocalDate endDate;

    /** 目标岗位（逗号分隔） */
    private String targetPositions;

    /** 目标城市（逗号分隔） */
    private String targetCities;

    private Integer targetApplyCount;

    private Integer targetInterviewCount;

    private Integer targetOfferCount;

    /** 状态: DRAFT/IN_PROGRESS/PAUSED/COMPLETED/ARCHIVED */
    private String status;

    /** 是否当前进行中(1=是,0=否) */
    private Integer isActive;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
