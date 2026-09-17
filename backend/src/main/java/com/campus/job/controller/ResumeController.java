package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.service.ResumeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 简历资料库接口
 */
@RestController
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;

    // ===== 基本资料 =====
    @GetMapping("/api/profile")
    public Result<Map<String, Object>> getProfile() {
        return Result.ok(resumeService.getProfile());
    }

    @PutMapping("/api/profile")
    public Result<Void> saveProfile(@RequestBody Map<String, Object> body) {
        resumeService.saveProfile(body);
        return Result.ok();
    }

    // ===== 简历版本 =====
    @GetMapping("/api/resumes")
    public Result<List<Map<String, Object>>> list() {
        return Result.ok(resumeService.list());
    }

    @PostMapping("/api/resumes")
    public Result<Long> create(@RequestBody Map<String, Object> body) {
        return Result.ok(resumeService.create(body));
    }

    @GetMapping("/api/resumes/{id}")
    public Result<Map<String, Object>> detail(@PathVariable Long id) {
        return Result.ok(resumeService.detail(id));
    }

    @PutMapping("/api/resumes/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        resumeService.update(id, body);
        return Result.ok();
    }

    @DeleteMapping("/api/resumes/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        resumeService.delete(id);
        return Result.ok();
    }

    @PostMapping("/api/resumes/{id}/copy")
    public Result<Long> copy(@PathVariable Long id) {
        return Result.ok(resumeService.copy(id));
    }

    @PostMapping("/api/resumes/{id}/set-default")
    public Result<Void> setDefault(@PathVariable Long id) {
        resumeService.setDefault(id);
        return Result.ok();
    }

    // ===== 模块 CRUD =====
    @GetMapping("/api/resumes/{id}/sections/{type}")
    public Result<List<Map<String, Object>>> listSection(@PathVariable Long id, @PathVariable String type) {
        return Result.ok(resumeService.listSection(id, type));
    }

    @PostMapping("/api/resumes/{id}/sections/{type}")
    public Result<Long> addSection(@PathVariable Long id, @PathVariable String type, @RequestBody Map<String, Object> body) {
        return Result.ok(resumeService.addSection(id, type, body));
    }

    @PutMapping("/api/resumes/{id}/sections/{type}/{itemId}")
    public Result<Void> updateSection(@PathVariable Long id, @PathVariable String type, @PathVariable Long itemId, @RequestBody Map<String, Object> body) {
        resumeService.updateSection(id, type, itemId, body);
        return Result.ok();
    }

    @DeleteMapping("/api/resumes/{id}/sections/{type}/{itemId}")
    public Result<Void> deleteSection(@PathVariable Long id, @PathVariable String type, @PathVariable Long itemId) {
        resumeService.deleteSection(id, type, itemId);
        return Result.ok();
    }
}
