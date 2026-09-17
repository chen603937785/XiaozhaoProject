package com.campus.job.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 配置: CORS + 拦截器
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final JwtInterceptor jwtInterceptor;
    private final AdminInterceptor adminInterceptor;

    public WebConfig(JwtInterceptor jwtInterceptor, AdminInterceptor adminInterceptor) {
        this.jwtInterceptor = jwtInterceptor;
        this.adminInterceptor = adminInterceptor;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 用户鉴权
        registry.addInterceptor(jwtInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/auth/login",
                        "/api/auth/register",
                        "/api/auth/password-login",
                        "/api/jobs/**",
                        "/api/companies/**",
                        "/api/meta/**",
                        "/api/config",
                        "/api/fetch-title",
                        "/api/version/**"
                );
        // 管理后台鉴权(静态页面放行)
        registry.addInterceptor(adminInterceptor)
                .addPathPatterns("/admin/**")
                .excludePathPatterns("/admin/login", "/admin/index.html", "/admin/");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 安装包下载目录（部署机 /opt/campus-job/downloads/）
        registry.addResourceHandler("/downloads/**")
                .addResourceLocations("file:/opt/campus-job/downloads/");
    }
}
