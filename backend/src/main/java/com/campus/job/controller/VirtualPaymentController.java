package com.campus.job.controller;

import com.campus.job.common.Result;
import com.campus.job.service.VirtualPaymentService;
import com.campus.job.service.PaymentCrypto;
import com.campus.job.service.PaymentFulfillment;
import com.campus.job.config.VirtualPaymentConfig;
import org.w3c.dom.Document;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.io.BufferedReader;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class VirtualPaymentController {
    private final VirtualPaymentService service;
    private final PaymentCrypto crypto;
    private final PaymentFulfillment fulfillment;
    private final VirtualPaymentConfig config;

    @PostMapping("/api/pay/order")
    public Result<Map<String,Object>> order(@RequestBody Map<String,Object> body) { return Result.ok(service.createOrder((String)body.get("planType"),(String)body.get("wxLoginCode"),((Number)body.get("priceFen")).intValue())); }

    @GetMapping("/api/pay/catalog") public Result<List<Map<String,Object>>> catalog(){ return Result.ok(service.catalog()); }

    @PostMapping("/api/pay/query")
    public Result<Map<String,Object>> query(@RequestBody Map<String,String> body) { return Result.ok(service.query(body.get("outTradeNo"))); }

    @GetMapping(value="/pay/notify", produces="text/plain;charset=UTF-8")
    public String verify(@RequestParam String signature,@RequestParam String timestamp,@RequestParam String nonce,@RequestParam String echostr) throws Exception { crypto.verifyUrl(signature,timestamp,nonce); return echostr; }
    @PostMapping(value="/pay/notify", produces="application/xml;charset=UTF-8")
    public String notify(HttpServletRequest request,@RequestParam String signature,@RequestParam String timestamp,@RequestParam String nonce) throws Exception {
        if(!config.ready()) return failure();
        StringBuilder b=new StringBuilder(); BufferedReader r=request.getReader(); String line; while((line=r.readLine())!=null)b.append(line);
        Document d=crypto.decrypt(b.toString(),signature,timestamp,nonce); org.w3c.dom.Element root=d.getDocumentElement();
        String event=PaymentCrypto.field(root,"Event"); if(!"xpay_goods_deliver_notify".equals(event)) return service.successXml();
        org.w3c.dom.Element wi=PaymentCrypto.child(root,"WeChatPayInfo"), gi=PaymentCrypto.child(root,"GoodsInfo");
        fulfillment.deliver(PaymentCrypto.field(root,"OutTradeNo"),PaymentCrypto.field(wi,"MchOrderNo"),PaymentCrypto.field(root,"OpenId"),PaymentCrypto.field(gi,"ProductId"),Integer.parseInt(PaymentCrypto.field(gi,"Quantity")),Integer.parseInt(PaymentCrypto.field(gi,"ActualPrice")),PaymentCrypto.field(gi,"Attach")); return service.successXml();
    }
    private String failure(){return "<xml><ErrCode>1</ErrCode><ErrMsg><![CDATA[not ready]]></ErrMsg></xml>";}
    private Map<String,String> parse(String xml) { Map<String,String> m=new LinkedHashMap<>(); for(String key:new String[]{"OpenId","OutTradeNo","MchOrderNo","ProductId","Quantity"}) { String a="<"+key+">", z="</"+key+">"; int i=xml.indexOf(a), j=xml.indexOf(z); if(i>=0&&j>i)m.put(key,xml.substring(i+a.length(),j).replace("<![CDATA[","").replace("]]>","")); } return m; }
}
