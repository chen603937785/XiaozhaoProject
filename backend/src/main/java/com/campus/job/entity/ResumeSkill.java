package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("resume_skill")
public class ResumeSkill {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;
    private Long resumeId;

    private String skillName;
    private String level;
    private String years;

    private Integer sortOrder;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
