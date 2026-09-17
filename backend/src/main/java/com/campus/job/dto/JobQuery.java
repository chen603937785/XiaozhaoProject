package com.campus.job.dto;

import lombok.Data;

/**
 * 岗位筛选查询参数
 */
@Data
public class JobQuery {

    /** 关键字(公司名/岗位) */
    private String keyword;

    /** 公司名称(精确, 用于查询某公司全部岗位) */
    private String companyName;

    /** 招聘类型, 逗号分隔多选 */
    private String recruitType;

    /** 企业性质, 逗号分隔多选 */
    private String nature;

    /** 行业, 逗号分隔多选 */
    private String industry;

    /** 届别, 单值, 如 27 */
    private Integer grade;

    /** 工作地点, 逗号分隔多选 */
    private String city;

    /** 学历, 单值, 如 本科 */
    private String education;

    /** 排序: deadline=截止临近优先, publish=最新发布优先, 默认相关度 */
    private String sort;

    /** 页码, 从1开始 */
    private Integer page = 1;

    /** 每页条数 */
    private Integer size = 20;
}
