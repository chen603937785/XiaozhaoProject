package com.campus.job.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.campus.job.entity.Config;
import com.campus.job.mapper.ConfigMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 系统配置服务
 */
@Service
@RequiredArgsConstructor
public class ConfigService {

    private final ConfigMapper configMapper;

    /** 激励广告开关 */
    public static final String KEY_REWARD_AD = "reward_ad_enabled";
    /** 绑定手机号弹窗开关 */
    public static final String KEY_BIND_PHONE = "bind_phone_enabled";
    /** 客服微信二维码图片路径 */
    public static final String KEY_CUSTOMER_QR = "customer_qr_image";

    private static final String[] ALL_KEYS = {KEY_REWARD_AD, KEY_BIND_PHONE};
    private static final String[][] VIP_PLANS = {
            {"month", "月卡", "30", "19.9", "9.9"},
            {"quarter", "季卡", "90", "49.9", "25.9"},
            {"year", "年卡", "365", "168", "88"}
    };

    public String getValue(String key) {
        Config c = configMapper.selectOne(new QueryWrapper<Config>().eq("cfg_key", key));
        return c == null ? null : c.getCfgValue();
    }

    /** 是否开启(默认关闭) */
    public boolean isEnabled(String key) {
        return "1".equals(getValue(key));
    }

    /** 小程序公开配置 */
    public Map<String, Object> publicConfig() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("rewardAdEnabled", isEnabled(KEY_REWARD_AD));
        map.put("bindPhoneEnabled", isEnabled(KEY_BIND_PHONE));
        map.put("customerQrImage", getValue(KEY_CUSTOMER_QR));
        map.put("vipPrices", vipPrices());
        return map;
    }

    /** 读取客服微信二维码路径 */
    public String getCustomerQr() {
        return getValue(KEY_CUSTOMER_QR);
    }

    /** 设置客服微信二维码路径 */
    public void setCustomerQr(String path) {
        setValue(KEY_CUSTOMER_QR, path);
    }

    /** 管理后台全量配置 */
    public Map<String, Object> allConfig() {
        Map<String, Object> map = new LinkedHashMap<>();
        for (String key : ALL_KEYS) {
            map.put(key, isEnabled(key));
        }
        map.put("vipPrices", vipPrices());
        return map;
    }

    /** 会员价格：未配置时使用默认原价和限时价。原价留空表示不展示划线价。 */
    public List<Map<String, Object>> vipPrices() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (String[] plan : VIP_PLANS) {
            String original = getValue("vip_" + plan[0] + "_original");
            String sale = getValue("vip_" + plan[0] + "_sale");
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("key", plan[0]);
            item.put("name", plan[1]);
            item.put("days", Integer.parseInt(plan[2]));
            item.put("original", original == null ? plan[3] : cleanPrice(original));
            item.put("sale", sale == null || cleanPrice(sale).isEmpty() ? plan[4] : cleanPrice(sale));
            result.add(item);
        }
        return result;
    }

    /** 保存会员原价与限时价。body: { month: {original, sale}, quarter: {...}, year: {...} } */
    public void saveVipPrices(Map<String, Map<String, String>> body) {
        if (body == null) return;
        for (String[] plan : VIP_PLANS) {
            Map<String, String> info = body.get(plan[0]);
            if (info == null) continue;
            if (info.containsKey("original")) {
                setValue("vip_" + plan[0] + "_original", cleanPrice(info.get("original")));
            }
            if (info.containsKey("sale")) {
                String sale = cleanPrice(info.get("sale"));
                if (!sale.isEmpty()) setValue("vip_" + plan[0] + "_sale", sale);
            }
        }
    }

    private String cleanPrice(String raw) {
        if (raw == null) return "";
        String value = raw.trim();
        return value.matches("\\d{1,6}(\\.\\d{1,2})?") ? value : "";
    }

    /** 更新配置 */
    public void updateConfig(Map<String, Boolean> updates) {
        for (Map.Entry<String, Boolean> e : updates.entrySet()) {
            String key = e.getKey();
            String value = Boolean.TRUE.equals(e.getValue()) ? "1" : "0";
            setValue(key, value);
        }
    }

    /** 通用：设置字符串配置值（不存在则插入，存在则更新） */
    public void setValue(String key, String value) {
        Config existing = configMapper.selectOne(new QueryWrapper<Config>().eq("cfg_key", key));
        if (existing == null) {
            Config c = new Config();
            c.setCfgKey(key);
            c.setCfgValue(value);
            configMapper.insert(c);
        } else {
            existing.setCfgValue(value);
            configMapper.updateById(existing);
        }
    }

    // ===== 版本信息（按平台区分 mac / win） =====

    private static final String[] PLATFORMS = {"mac", "win"};

    /** 读取当前版本信息（mac/win 各 version/url/note） */
    public Map<String, Object> versionInfo() {
        Map<String, Object> result = new HashMap<>();
        for (String p : PLATFORMS) {
            Map<String, Object> info = new HashMap<>();
            info.put("version", getValue("app_version_" + p));
            info.put("url", getValue("app_url_" + p));
            info.put("note", getValue("app_note_" + p));
            result.put(p, info);
        }
        return result;
    }

    /** 保存版本信息。body: { mac: {version,url,note}, win: {version,url,note} } */
    public void saveVersion(Map<String, Map<String, String>> body) {
        for (String p : PLATFORMS) {
            Map<String, String> info = body.get(p);
            if (info == null) continue;
            if (info.containsKey("version")) setValue("app_version_" + p, info.get("version"));
            if (info.containsKey("url")) setValue("app_url_" + p, info.get("url"));
            if (info.containsKey("note")) setValue("app_note_" + p, info.get("note"));
        }
    }
}
