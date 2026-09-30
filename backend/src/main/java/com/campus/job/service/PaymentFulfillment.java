package com.campus.job.service;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.job.common.BusinessException;
import com.campus.job.entity.User;
import com.campus.job.entity.VirtualPaymentOrder;
import com.campus.job.mapper.UserMapper;
import com.campus.job.mapper.VirtualPaymentOrderMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service @RequiredArgsConstructor
public class PaymentFulfillment {
 private final VirtualPaymentOrderMapper orders; private final UserMapper users;
 @Transactional
 public void deliver(String number,String wx,String openid,String product,int qty,int price,String attach){
  if(wx==null||wx.length()>64||number==null||openid==null||product==null||qty<1)throw new BusinessException(400,"回调参数无效");
  VirtualPaymentOrder o=orders.lock(number); if(o==null)throw new BusinessException(404,"订单不存在");
  if(!number.equals(o.getOutTradeNo())||!openid.equals(o.getOpenid())||!product.equals(o.getProductId())||qty!=o.getQuantity()||price!=o.getGoodsPrice()||!number.equals(o.getAttach()))throw new BusinessException(400,"回调订单校验失败");
  if("DELIVERED".equals(o.getStatus())) { if(wx.equals(o.getWxOrderId())) return; throw new BusinessException(409,"订单已绑定其他平台单号"); }
  VirtualPaymentOrder same=orders.selectOne(new LambdaQueryWrapper<VirtualPaymentOrder>().eq(VirtualPaymentOrder::getWxOrderId,wx)); if(same!=null&&!number.equals(same.getOutTradeNo()))throw new BusinessException(409,"平台订单号重复");
  User u=users.selectById(o.getUserId()); if(u==null||!openid.equals(o.getOpenid()))throw new BusinessException(400,"用户不存在"); LocalDateTime now=LocalDateTime.now();LocalDateTime base=u.getVipExpire()!=null&&u.getVipExpire().isAfter(now)?u.getVipExpire():now;
  User update=new User();update.setId(u.getId());update.setIsVip(1);update.setVipExpire(base.plusDays(o.getDurationDays()*qty));users.updateById(update);
  o.setWxOrderId(wx);o.setStatus("DELIVERED");o.setPaidAt(now);o.setDeliveredAt(now);orders.updateById(o);
 }
 @Transactional public void flagRefund(String n,String wx,String openid){VirtualPaymentOrder o=orders.lock(n);if(o!=null&&openid.equals(o.getOpenid())&&("DELIVERED".equals(o.getStatus())||"PENDING".equals(o.getStatus()))){o.setStatus("REFUNDED");o.setWxOrderId(wx);orders.updateById(o);}}
}
