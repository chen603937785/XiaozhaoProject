package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 待办（今日待办）
 */
@Data
@TableName("todo")
public class Todo {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** 归属求职计划 */
    private Long planId;

    /** 关联岗位（可选） */
    private Long jobId;

    private String title;

    private String description;

    /** APPLICATION/MATERIAL/ASSESSMENT/INTERVIEW/FOLLOW_UP/CUSTOM */
    private String todoType;

    /** URGENT/IMPORTANT/NORMAL */
    private String priority;

    /** PENDING/COMPLETED */
    private String status;

    private LocalDateTime dueAt;

    /** SYSTEM/USER */
    private String source;

    private LocalDateTime completedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
