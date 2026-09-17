package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;

/**
 * 岗位信息实体
 */
@Data
@TableName("job")
public class Job {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 网申更新日期 */
    private LocalDate publishDate;

    /** 公司名称 */
    private String companyName;

    /** 标准行业(逗号分隔多值) */
    private String industry;

    /** 原始行业 */
    private String industryRaw;

    /** 标准招聘类型(逗号分隔多值) */
    private String recruitTypes;

    /** 原始招聘类型 */
    private String recruitTypeRaw;

    /** 标准企业性质 */
    private String companyNature;

    /** 原始企业性质 */
    private String companyNatureRaw;

    /** 原始招聘对象 */
    private String targetRaw;

    /** 届别下限(不限届=0) */
    private Integer gradeMin;

    /** 届别上限(不限届=99) */
    private Integer gradeMax;

    /** 最低学历要求 */
    private String education;

    /** 招聘岗位(逗号分隔) */
    private String positions;

    /** 工作地点(逗号分隔) */
    private String cities;

    /** 网申公告链接 */
    private String noticeUrl;

    /** 投递链接 */
    private String applyUrl;

    /** 截止说明 */
    private String deadline;

    /** 截止日期 */
    private LocalDate deadlineDate;

    /** 备注 */
    private String remark;

    /** 状态(1=上架,0=下架) */
    private Integer status;
}
