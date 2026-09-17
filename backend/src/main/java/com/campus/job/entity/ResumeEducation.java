package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("resume_education")
public class ResumeEducation {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;
    private Long resumeId;

    private String schoolName;
    private String major;
    private String educationLevel;
    private String degree;
    private String startDate;
    private String endDate;
    private String gpa;
    private String courses;
    private String description;

    private Integer sortOrder;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
