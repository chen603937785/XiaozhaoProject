package com.campus.job.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.job.common.BusinessException;
import com.campus.job.common.UserContext;
import com.campus.job.entity.Favorite;
import com.campus.job.entity.Job;
import com.campus.job.mapper.FavoriteMapper;
import com.campus.job.mapper.JobMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 收藏服务
 */
@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteMapper favoriteMapper;
    private final JobMapper jobMapper;

    /**
     * 收藏岗位
     */
    public void add(Long jobId) {
        Long userId = UserContext.getUserId();
        Job job = jobMapper.selectById(jobId);
        if (job == null) {
            throw new BusinessException(404, "岗位不存在");
        }
        // 已收藏则不重复插入
        Long count = favoriteMapper.selectCount(
                new LambdaQueryWrapper<Favorite>()
                        .eq(Favorite::getUserId, userId)
                        .eq(Favorite::getJobId, jobId));
        if (count != null && count > 0) {
            return;
        }
        Favorite favorite = new Favorite();
        favorite.setUserId(userId);
        favorite.setJobId(jobId);
        try {
            favoriteMapper.insert(favorite);
        } catch (DuplicateKeyException e) {
            // 并发下唯一键兜底
        }
    }

    /**
     * 取消收藏
     */
    public void remove(Long jobId) {
        Long userId = UserContext.getUserId();
        favoriteMapper.delete(
                new LambdaQueryWrapper<Favorite>()
                        .eq(Favorite::getUserId, userId)
                        .eq(Favorite::getJobId, jobId));
    }

    /**
     * 我的收藏列表 (按收藏时间倒序, 返回岗位实体)
     */
    public List<Job> list() {
        Long userId = UserContext.getUserId();
        List<Favorite> favorites = favoriteMapper.selectList(
                new LambdaQueryWrapper<Favorite>()
                        .eq(Favorite::getUserId, userId)
                        .orderByDesc(Favorite::getCreatedAt));
        if (favorites.isEmpty()) {
            return new ArrayList<>();
        }
        List<Long> jobIds = favorites.stream()
                .map(Favorite::getJobId)
                .collect(Collectors.toList());
        List<Job> jobs = jobMapper.selectBatchIds(jobIds);
        // 按收藏时间顺序重组(selectBatchIds 不保证顺序)
        Map<Long, Job> map = jobs.stream()
                .collect(Collectors.toMap(Job::getId, Function.identity()));
        return jobIds.stream()
                .map(map::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /**
     * 判断某岗位是否已收藏
     */
    public boolean isFavorite(Long jobId) {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            return false;
        }
        Long count = favoriteMapper.selectCount(
                new LambdaQueryWrapper<Favorite>()
                        .eq(Favorite::getUserId, userId)
                        .eq(Favorite::getJobId, jobId));
        return count != null && count > 0;
    }
}
