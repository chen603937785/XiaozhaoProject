package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.dto.FavoriteRequest;
import com.campus.job.entity.Job;
import com.campus.job.service.FavoriteService;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private final FavoriteService favoriteService;

    @PostMapping
    public Result<Void> add(@Validated @RequestBody FavoriteRequest request) {
        favoriteService.add(request.getJobId());
        return Result.ok();
    }

    @DeleteMapping("/{jobId}")
    public Result<Void> remove(@PathVariable Long jobId) {
        favoriteService.remove(jobId);
        return Result.ok();
    }

    @GetMapping
    public Result<List<Job>> list() {
        return Result.ok(favoriteService.list());
    }

    @GetMapping("/status/{jobId}")
    public Result<Map<String, Object>> status(@PathVariable Long jobId) {
        boolean fav = favoriteService.isFavorite(jobId);
        Map<String, Object> map = new java.util.HashMap<>();
        map.put("favorite", fav);
        return Result.ok(map);
    }
}
