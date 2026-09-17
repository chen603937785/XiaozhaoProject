package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.dto.AdminLoginRequest;
import com.campus.job.service.AdminService;
import com.campus.job.service.ConfigService;
import com.campus.job.service.RedeemService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 管理后台接口
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final ConfigService configService;
    private final RedeemService redeemService;

    @PostMapping("/login")
    public Result<Map<String, Object>> login(@RequestBody AdminLoginRequest request) {
        String token = adminService.login(request.getUsername(), request.getPassword());
        return Result.ok(java.util.Collections.singletonMap("token", token));
    }

    @GetMapping("/stats")
    public Result<Map<String, Object>> stats() {
        return Result.ok(adminService.stats());
    }

    @GetMapping("/users")
    public Result<Map<String, Object>> users(@RequestParam(defaultValue = "1") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        return Result.ok(adminService.userList(page, size));
    }

    @PutMapping("/users/{id}/vip")
    public Result<Void> updateUserVip(@PathVariable Long id, @RequestBody Map<String, String> body) {
        adminService.updateUserVip(id, "true".equals(body.get("isVip")), body.get("expire"));
        return Result.ok();
    }

    @GetMapping("/jobs")
    public Result<Map<String, Object>> jobs(@RequestParam(defaultValue = "1") int page,
                                            @RequestParam(defaultValue = "20") int size,
                                            @RequestParam(required = false) String keyword,
                                            @RequestParam(required = false) Integer status) {
        return Result.ok(adminService.jobList(page, size, keyword, status));
    }

    @PutMapping("/jobs/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam Integer status) {
        adminService.updateStatus(id, status);
        return Result.ok();
    }

    @PostMapping("/import")
    public Result<Map<String, Object>> importCsv(@RequestBody String csvContent) {
        int count = adminService.importCsv(csvContent);
        return Result.ok(java.util.Collections.singletonMap("count", count));
    }

    @GetMapping("/config")
    public Result<Map<String, Object>> config() {
        return Result.ok(configService.allConfig());
    }

    @PutMapping("/config")
    public Result<Void> updateConfig(@RequestBody Map<String, Boolean> updates) {
        configService.updateConfig(updates);
        return Result.ok();
    }

    @GetMapping("/version")
    public Result<Map<String, Object>> version() {
        return Result.ok(configService.versionInfo());
    }

    @PostMapping("/version")
    public Result<Void> updateVersion(@RequestBody Map<String, Map<String, String>> body) {
        configService.saveVersion(body);
        return Result.ok();
    }

    @PostMapping("/redeem/generate")
    public Result<List<String>> generateRedeem(@RequestBody Map<String, Object> body) {
        String planType = String.valueOf(body.get("planType"));
        int count = body.get("count") == null ? 1 : Integer.parseInt(String.valueOf(body.get("count")));
        String remark = body.get("remark") == null ? null : String.valueOf(body.get("remark"));
        return Result.ok(redeemService.generate(planType, count, remark));
    }

    @GetMapping("/redeem/codes")
    public Result<Map<String, Object>> redeemCodes(@RequestParam(defaultValue = "1") int page,
                                                   @RequestParam(defaultValue = "20") int size,
                                                   @RequestParam(required = false) String status) {
        return Result.ok(redeemService.listCodes(page, size, status));
    }

    @GetMapping("/redeem/records")
    public Result<Map<String, Object>> redeemRecords(@RequestParam(defaultValue = "1") int page,
                                                     @RequestParam(defaultValue = "20") int size) {
        return Result.ok(redeemService.listRecords(page, size));
    }

    /** 上传安装包到 downloads 目录，返回文件名和下载地址 */
    @PostMapping("/upload")
    public Result<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) {
        try {
            String filename = file.getOriginalFilename();
            if (filename == null || filename.isEmpty()) {
                return Result.fail(400, "文件名不能为空");
            }
            File dir = new File("/opt/campus-job/downloads/");
            if (!dir.exists()) dir.mkdirs();
            File dest = new File(dir, filename);
            file.transferTo(dest);
            Map<String, Object> result = new HashMap<>();
            result.put("filename", filename);
            result.put("url", "/downloads/" + filename);
            return Result.ok(result);
        } catch (Exception e) {
            return Result.fail(500, "上传失败：" + e.getMessage());
        }
    }
}
