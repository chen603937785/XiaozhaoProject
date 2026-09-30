package com.campus.job.config;

import com.campus.job.common.BusinessException;
import lombok.Data;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Data
@Component
@ConfigurationProperties(prefix = "wechat.virtual-payment")
public class VirtualPaymentConfig {
    private boolean enabled;
    private String offerId = "", appKey = "", callbackToken = "", encodingAesKey = "";
    private String monthProductId = "", quarterProductId = "", yearProductId = "";
    private int monthPrice, quarterPrice, yearPrice;
    @Value("${wechat.appid:}") private String appid;
    @Value("${wechat.secret:}") private String secret;
    @Value("${wechat.mock-openid:true}") private boolean mockOpenid;

    public boolean ready() {
        return enabled && !mockOpenid && StringUtils.hasText(appid) && StringUtils.hasText(secret)
                && StringUtils.hasText(offerId) && StringUtils.hasText(appKey)
                && StringUtils.hasText(callbackToken) && encodingAesKey.length() == 43
                && StringUtils.hasText(monthProductId) && StringUtils.hasText(quarterProductId)
                && StringUtils.hasText(yearProductId) && monthPrice > 0 && quarterPrice > 0 && yearPrice > 0
                && !monthProductId.equals(quarterProductId) && !monthProductId.equals(yearProductId)
                && !quarterProductId.equals(yearProductId);
    }
    public void requireReady() {
        if (!ready()) throw new BusinessException(503, "会员支付暂未开放，请稍后再试");
    }
}
