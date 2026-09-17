package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 系统配置实体
 */
@Data
@TableName("config")
public class Config {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 配置键 */
    private String cfgKey;

    /** 配置值 */
    private String cfgValue;
}
