package com.campus.job.controller;

import cn.hutool.http.HttpUtil;
import com.campus.job.common.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 获取外部网页标题（供桌面端页签展示用）
 */
@RestController
@RequestMapping("/api")
public class TitleController {

    private static final Pattern TITLE_PATTERN = Pattern.compile(
            "<title[^>]*>(.*?)</title>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    @GetMapping("/fetch-title")
    public Result<String> fetchTitle(@RequestParam String url) {
        try {
            String html = HttpUtil.get(url, 8000);
            Matcher m = TITLE_PATTERN.matcher(html);
            String title = m.find() ? m.group(1).trim() : "";
            title = title.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                    .replace("&quot;", "\"").replace("&#39;", "'").replace("&nbsp;", " ");
            return Result.ok(title);
        } catch (Exception e) {
            return Result.ok("");
        }
    }
}
