package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("resume_experience")
public class ResumeExperience {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;
    private Long resumeId;

    private String companyName;
    private String position;
    private String city;
    private String startDate;
    private String endDate;
    private Integer isCurrent;
    private String description;
    private String achievements;

    private Integer sortOrder;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
