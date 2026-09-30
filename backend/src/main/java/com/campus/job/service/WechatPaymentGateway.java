package com.campus.job.service;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.campus.job.common.BusinessException;
import com.campus.job.config.VirtualPaymentConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Official endpoints only; never log URLs, session keys, access tokens or raw responses. */
@Component
@RequiredArgsConstructor
public class WechatPaymentGateway {
    private final VirtualPaymentConfig config;
    private String accessToken;
    private long tokenExpires;

    public JSONObject session(String code) {
        if (code == null || !code.matches("[A-Za-z0-9_-]{1,256}")) throw new BusinessException(400, "请重新获取微信登录凭证");
        JSONObject r = request(HttpRequest.get("https://api.weixin.qq.com/sns/jscode2session?appid="
                + enc(config.getAppid()) + "&secret=" + enc(config.getSecret()) + "&js_code=" + enc(code) + "&grant_type=authorization_code"));
        if (!r.containsKey("openid") || !r.containsKey("session_key")) throw unavailable();
        return r;
    }
    private synchronized String token() {
        if (accessToken != null && System.currentTimeMillis() < tokenExpires) return accessToken;
        // Stable token avoids invalidating the token used by other services of this mini-program.
        String raw = JSONUtil.createObj().set("grant_type", "client_credential").set("appid", config.getAppid())
                .set("secret", config.getSecret()).set("force_refresh", false).toString();
        JSONObject r = request(HttpRequest.post("https://api.weixin.qq.com/cgi-bin/stable_token").body(raw).contentType("application/json"));
        accessToken = r.getStr("access_token");
        if (accessToken == null) throw unavailable();
        tokenExpires = System.currentTimeMillis() + Math.max(0, r.getInt("expires_in", 0) - 120) * 1000L;
        return accessToken;
    }
    public JSONObject call(String operation, Map<String, Object> body) {
        if (!"query_order".equals(operation) && !"notify_provide_goods".equals(operation)) throw new IllegalArgumentException();
        String uri = "/xpay/" + operation;
        String raw = JSONUtil.toJsonStr(body);
        String url = "https://api.weixin.qq.com" + uri + "?access_token=" + enc(token())
                + "&pay_sig=" + PaymentCrypto.hmac(config.getAppKey(), uri + "&" + raw);
        return request(HttpRequest.post(url).contentType("application/json").body(raw));
    }
    private JSONObject request(HttpRequest request) {
        try (HttpResponse response = request.timeout(8000).execute()) {
            if (!response.isOk()) throw unavailable();
            JSONObject r = JSONUtil.parseObj(response.body());
            if (r.getInt("errcode", 0) != 0) {
                if (r.getInt("errcode", 0) == 40001 || r.getInt("errcode", 0) == 42001) tokenExpires = 0;
                throw unavailable();
            }
            return r;
        } catch (Exception ex) { throw unavailable(); }
    }
    private BusinessException unavailable() { return new BusinessException(503, "微信支付服务暂不可用，请稍后查询订单"); }
    private String enc(String s) {
        try { return URLEncoder.encode(s, StandardCharsets.UTF_8.name()); }
        catch (Exception e) { throw new IllegalArgumentException(); }
    }
}
