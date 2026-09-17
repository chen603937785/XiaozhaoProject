package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("resume")
public class Resume {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String resumeName;
    private String targetPosition;
    private String targetCities;
    private String expectedSalary;
    private String availableDate;
    private String selfEvaluation;

    private Integer isDefault;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
