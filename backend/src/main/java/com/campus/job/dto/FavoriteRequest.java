package com.campus.job.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

/**
 * 收藏请求
 */
@Data
public class FavoriteRequest {

    @NotNull(message = "岗位id不能为空")
    private Long jobId;
}
