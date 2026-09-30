package com.campus.job.service;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.job.common.BusinessException;
import com.campus.job.common.UserContext;
import com.campus.job.config.VirtualPaymentConfig;
import com.campus.job.entity.VirtualPaymentOrder;
import com.campus.job.mapper.UserMapper;
import com.campus.job.mapper.VirtualPaymentOrderMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class VirtualPaymentService {
    private final VirtualPaymentConfig config;
    private final WechatPaymentGateway gateway;
    private final VirtualPaymentOrderMapper orders;
    private final UserMapper users;
    private final PaymentFulfillment fulfillment;
    public List<Map<String,Object>> catalog() {
        if (!config.ready()) return Collections.emptyList();
        return Arrays.asList(plan("MONTH","月卡",30,config.getMonthProductId(),config.getMonthPrice()),plan("QUARTER","季卡",90,config.getQuarterProductId(),config.getQuarterPrice()),plan("YEAR","年卡",365,config.getYearProductId(),config.getYearPrice()));
    }
    private Map<String,Object> plan(String t,String n,int d,String id,int p){Map<String,Object> x=new LinkedHashMap<>();x.put("planType",t);x.put("name",n);x.put("days",d);x.put("productId",id);x.put("priceFen",p);return x;}
    public Map<String,Object> createOrder(String type,String code,Integer confirmedPrice){
        config.requireReady(); Long uid=UserContext.getUserId(); if(uid==null||users.selectById(uid)==null)throw new BusinessException(401,"请先登录");
        Map<String,Object> p=catalog().stream().filter(x->x.get("planType").equals(type)).findFirst().orElseThrow(()->new BusinessException(400,"未知会员套餐"));
        if(!p.get("priceFen").equals(confirmedPrice))throw new BusinessException(409,"价格已更新，请重新选择套餐");
        if(orders.selectCount(new LambdaQueryWrapper<VirtualPaymentOrder>().eq(VirtualPaymentOrder::getUserId,uid).ge(VirtualPaymentOrder::getCreatedAt,LocalDateTime.now().minusMinutes(1)))>=5)throw new BusinessException(429,"操作频繁，请稍后再试");
        JSONObject session=gateway.session(code); String number="T"+UUID.randomUUID().toString().replace("-","").substring(0,31);
        VirtualPaymentOrder o=new VirtualPaymentOrder();o.setOutTradeNo(number);o.setUserId(uid);o.setOpenid(session.getStr("openid"));o.setProductId((String)p.get("productId"));o.setPlanType(type);o.setDurationDays((Integer)p.get("days"));o.setGoodsPrice((Integer)p.get("priceFen"));o.setQuantity(1);o.setAttach(number);o.setStatus("PENDING");o.setReported(false);o.setCreatedAt(LocalDateTime.now());
        Map<String,Object>b=new LinkedHashMap<>();b.put("offerId",config.getOfferId());b.put("buyQuantity",1);b.put("env",0);b.put("currencyType","CNY");b.put("productId",o.getProductId());b.put("goodsPrice",o.getGoodsPrice());b.put("outTradeNo",number);b.put("attach",number);String raw=JSONUtil.toJsonStr(b);
        Map<String,Object> result=new LinkedHashMap<>();result.put("mode","short_series_goods");result.put("signData",raw);result.put("paySig",PaymentCrypto.hmac(config.getAppKey(),"requestVirtualPayment&"+raw));result.put("signature",PaymentCrypto.hmac(session.getStr("session_key"),raw));result.put("outTradeNo",number);orders.insert(o);return result;
    }
    public Map<String,Object> query(String number){VirtualPaymentOrder o=owned(number);if(config.ready()&&"PENDING".equals(o.getStatus()))try{reconcile(o);}catch(BusinessException ignored){}o=owned(number);Map<String,Object>r=new LinkedHashMap<>();r.put("outTradeNo",number);r.put("status",o.getStatus());return r;}
    private VirtualPaymentOrder owned(String n){if(n==null||!n.matches("T[a-f0-9]{31}"))throw new BusinessException(400,"订单号无效");Long uid=UserContext.getUserId();if(uid==null)throw new BusinessException(401,"未登录");VirtualPaymentOrder o=orders.selectOne(new LambdaQueryWrapper<VirtualPaymentOrder>().eq(VirtualPaymentOrder::getOutTradeNo,n).eq(VirtualPaymentOrder::getUserId,uid));if(o==null)throw new BusinessException(404,"订单不存在");return o;}
    public void reconcile(VirtualPaymentOrder o){config.requireReady();if(orders.claimQuery(o.getId(),LocalDateTime.now(),LocalDateTime.now().minusSeconds(30))==0)return;Map<String,Object>b=new LinkedHashMap<>();b.put("openid",o.getOpenid());b.put("env",0);b.put("order_id",o.getOutTradeNo());JSONObject reply=gateway.call("query_order",b),r=reply.getJSONObject("order");if(r==null||!o.getOutTradeNo().equals(r.getStr("order_id"))||r.getInt("env_type",-1)!=1||r.getInt("order_fee",-1)!=o.getGoodsPrice()*o.getQuantity())throw new BusinessException(502,"微信订单校验失败");int s=r.getInt("status",-1);if(s==2||s==3||s==4){fulfillment.deliver(o.getOutTradeNo(),r.getStr("wx_order_id"),o.getOpenid(),o.getProductId(),o.getQuantity(),o.getGoodsPrice(),o.getAttach());if(s!=4){Map<String,Object>x=new LinkedHashMap<>();x.put("order_id",o.getOutTradeNo());x.put("env",0);gateway.call("notify_provide_goods",x);}orders.markReported(o.getOutTradeNo());}else if(s==5||s==8)fulfillment.flagRefund(o.getOutTradeNo(),r.getStr("wx_order_id"),o.getOpenid());else if(s==6)orders.closePending(o.getOutTradeNo());}
    public String successXml(){return "<xml><ErrCode>0</ErrCode><ErrMsg><![CDATA[success]]></ErrMsg></xml>";}
}
