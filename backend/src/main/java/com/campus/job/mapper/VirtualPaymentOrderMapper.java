package com.campus.job.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.campus.job.entity.VirtualPaymentOrder;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface VirtualPaymentOrderMapper extends BaseMapper<VirtualPaymentOrder> {
 @org.apache.ibatis.annotations.Select("SELECT * FROM virtual_payment_order WHERE out_trade_no=#{number} FOR UPDATE") VirtualPaymentOrder lock(String number);
 @org.apache.ibatis.annotations.Update("UPDATE virtual_payment_order SET last_checked_at=#{now} WHERE id=#{id} AND (last_checked_at IS NULL OR last_checked_at < #{before})") int claimQuery(@org.apache.ibatis.annotations.Param("id") Long id,@org.apache.ibatis.annotations.Param("now") java.time.LocalDateTime now,@org.apache.ibatis.annotations.Param("before") java.time.LocalDateTime before);
 @org.apache.ibatis.annotations.Update("UPDATE virtual_payment_order SET reported=1 WHERE out_trade_no=#{number} AND status='DELIVERED'") int markReported(String number);
 @org.apache.ibatis.annotations.Update("UPDATE virtual_payment_order SET status='CLOSED' WHERE out_trade_no=#{number} AND status='PENDING'") int closePending(String number);
 @org.apache.ibatis.annotations.Select("SELECT * FROM virtual_payment_order WHERE status='PENDING' OR (status='DELIVERED' AND reported=0) ORDER BY COALESCE(last_checked_at,created_at),id LIMIT 50") java.util.List<VirtualPaymentOrder> reconciliationBatch();
}
