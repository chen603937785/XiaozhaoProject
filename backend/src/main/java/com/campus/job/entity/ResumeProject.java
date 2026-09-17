package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("resume_project")
public class ResumeProject {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;
    private Long resumeId;

    private String projectName;
    private String role;
    private String startDate;
    private String endDate;
    private String background;
    private String responsibilities;
    private String achievements;
    private String skills;

    private Integer sortOrder;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
