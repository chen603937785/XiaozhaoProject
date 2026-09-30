package com.campus.job.service;
import com.campus.job.config.VirtualPaymentConfig;
import com.campus.job.entity.VirtualPaymentOrder;
import com.campus.job.mapper.VirtualPaymentOrderMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component @RequiredArgsConstructor
public class VirtualPaymentReconciliationJob {
 private final VirtualPaymentConfig config; private final VirtualPaymentOrderMapper orders; private final VirtualPaymentService service;
 @Scheduled(fixedDelayString="${wechat.virtual-payment.reconcile-delay-ms:300000}")
 public void run(){if(!config.ready())return;for(VirtualPaymentOrder o:orders.reconciliationBatch())try{service.reconcile(o);}catch(Exception ignored){}}
}
