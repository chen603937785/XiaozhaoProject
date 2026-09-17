package com.campus.job.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.campus.job.common.BusinessException;
import com.campus.job.common.UserContext;
import com.campus.job.entity.RedeemCode;
import com.campus.job.entity.RedeemRecord;
import com.campus.job.entity.User;
import com.campus.job.mapper.RedeemCodeMapper;
import com.campus.job.mapper.RedeemRecordMapper;
import com.campus.job.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 兑换码服务：生成兑换码 + 用户兑换（会员叠加）
 */
@Service
@RequiredArgsConstructor
public class RedeemService {

    private final RedeemCodeMapper codeMapper;
    private final RedeemRecordMapper recordMapper;
    private final UserMapper userMapper;

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private int planDays(String planType) {
        switch (planType) {
            case "MONTH": return 30;
            case "QUARTER": return 90;
            case "YEAR": return 365;
            default: throw new BusinessException(400, "未知套餐类型");
        }
    }

    private String genCode() {
        StringBuilder sb = new StringBuilder(16);
        for (int i = 0; i < 16; i++) {
            sb.append(CHARS.charAt(RANDOM.nextInt(CHARS.length())));
        }
        return sb.toString();
    }

    // ===== 用户兑换 =====
    @Transactional
    public Map<String, Object> redeem(String code) {
        Long uid = UserContext.getUserId();
        if (uid == null) throw new BusinessException(401, "未登录");
        String c = code == null ? "" : code.trim().toUpperCase();
        if (c.isEmpty()) throw new BusinessException(400, "请输入兑换码");

        RedeemCode rc = codeMapper.selectOne(new LambdaQueryWrapper<RedeemCode>().eq(RedeemCode::getCode, c));
        if (rc == null) throw new BusinessException(400, "兑换码不存在");
        if (!"UNUSED".equals(rc.getStatus())) throw new BusinessException(400, "兑换码已使用");
        LocalDateTime now = LocalDateTime.now();
        if (rc.getExpiredAt() != null && rc.getExpiredAt().isBefore(now)) {
            rc.setStatus("EXPIRED");
            codeMapper.updateById(rc);
            throw new BusinessException(400, "兑换码已过期");
        }

        // 会员叠加：从当前到期时间（或现在）往后加天数
        User user = userMapper.selectById(uid);
        LocalDateTime base = (user.getVipExpire() != null && user.getVipExpire().isAfter(now))
                ? user.getVipExpire() : now;
        LocalDateTime newExpire = base.plusDays(rc.getDays());
        User update = new User();
        update.setId(uid);
        update.setIsVip(1);
        update.setVipExpire(newExpire);
        userMapper.updateById(update);

        rc.setStatus("USED");
        rc.setUsedBy(uid);
        rc.setUsedAt(now);
        codeMapper.updateById(rc);

        RedeemRecord r = new RedeemRecord();
        r.setCode(c);
        r.setUserId(uid);
        r.setPlanType(rc.getPlanType());
        r.setDays(rc.getDays());
        r.setRedeemedAt(now);
        recordMapper.insert(r);

        Map<String, Object> result = new HashMap<>();
        result.put("planType", rc.getPlanType());
        result.put("days", rc.getDays());
        result.put("vipExpire", newExpire);
        return result;
    }

    // ===== 后台生成 =====
    @Transactional
    public List<String> generate(String planType, int count, String remark) {
        int days = planDays(planType);
        int n = Math.min(Math.max(count, 1), 100);
        LocalDateTime now = LocalDateTime.now();
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            RedeemCode rc = new RedeemCode();
            rc.setCode(genCode());
            rc.setPlanType(planType);
            rc.setDays(days);
            rc.setStatus("UNUSED");
            rc.setRemark(remark);
            rc.setCreatedAt(now);
            codeMapper.insert(rc);
            codes.add(rc.getCode());
        }
        return codes;
    }

    // ===== 后台列表 =====
    public Map<String, Object> listCodes(int page, int size, String status) {
        LambdaQueryWrapper<RedeemCode> wrapper = new LambdaQueryWrapper<RedeemCode>()
                .orderByDesc(RedeemCode::getId);
        if (status != null && !status.isEmpty()) wrapper.eq(RedeemCode::getStatus, status);
        Page<RedeemCode> p = codeMapper.selectPage(new Page<>(page, size), wrapper);
        List<Map<String, Object>> list = new ArrayList<>();
        for (RedeemCode rc : p.getRecords()) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", rc.getId());
            m.put("code", rc.getCode());
            m.put("planType", rc.getPlanType());
            m.put("days", rc.getDays());
            m.put("status", rc.getStatus());
            m.put("usedBy", rc.getUsedBy());
            m.put("usedAt", rc.getUsedAt());
            m.put("remark", rc.getRemark());
            m.put("createdAt", rc.getCreatedAt());
            list.add(m);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("records", list);
        result.put("total", p.getTotal());
        result.put("pages", p.getPages());
        return result;
    }

    public Map<String, Object> listRecords(int page, int size) {
        Page<RedeemRecord> p = recordMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<RedeemRecord>().orderByDesc(RedeemRecord::getId));
        List<Map<String, Object>> list = new ArrayList<>();
        for (RedeemRecord r : p.getRecords()) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", r.getId());
            m.put("code", r.getCode());
            m.put("userId", r.getUserId());
            m.put("planType", r.getPlanType());
            m.put("days", r.getDays());
            m.put("redeemedAt", r.getRedeemedAt());
            list.add(m);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("records", list);
        result.put("total", p.getTotal());
        result.put("pages", p.getPages());
        return result;
    }
}
