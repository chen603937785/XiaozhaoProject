# 个人主体小程序虚拟支付接入

代码默认关闭支付（`wechat.virtual-payment.enabled=false`），不会改变现有兑换码会员功能。

## 需要在服务器外部 application.yml 配置的值

不要把正式密钥提交到 Git，也不要在聊天中发送 AppKey、AppSecret、消息推送 Token 或 EncodingAESKey。请将下面配置写入服务器现有的外部 Spring 配置文件（通常是 `/opt/campus-job/application.yml`），并通过受控方式重启服务：

```yaml
wechat:
  appid: "小程序 AppID"
  secret: "小程序 AppSecret"
  mock-openid: false
  virtual-payment:
    enabled: true
    offer-id: "现网 OfferID"
    app-key: "现网 AppKey"
    month-product-id: "已发布的月卡道具 ID"
    quarter-product-id: "已发布的季卡道具 ID"
    year-product-id: "已发布的年卡道具 ID"
    month-price: 990       # 分，必须与道具后台价格一致
    quarter-price: 2590
    year-price: 8800
    callback-token: "消息推送配置中的 Token"
    encoding-aes-key: "消息推送配置中的 43 位 EncodingAESKey"
    reconcile-delay-ms: 300000
```

消息推送 URL 填：`https://my88ai.com/pay/notify`，数据格式 XML，建议安全模式。服务器会先完成 GET 验证，再只接受通过 `msg_signature` 验证并解密后的 `xpay_goods_deliver_notify` 消息。

## 当前开发实现

- 下单必须由已登录的手机号账号发起，并要求一次性的 `wx.login` code；微信 session_key 只在服务端内存请求中使用，不写入数据库、不返回小程序。
- 订单把产品 ID、分价格、会员天数、openid、用户 ID 固定快照；回调和查单会校验这些字段。
- `wx_order_id` 唯一去重，数据库行锁保证重复推送不会重复增加会员时长。
- 官方 `query_order` 使用 `access_token` 和 `/xpay/query_order&原始请求体` 签名；只有状态 2/3/4 且金额、环境、单号校验通过才发货。
- 每 5 分钟批量补查待支付或未确认发货订单；前端支付成功回调只触发查询，不作为到账依据。
- 支付配置未完整填写时，目录为空、下单返回“支付暂未开放”，不会产生真实订单。

## 仍需在平台侧验收

请按微信文档的部署前检查清单完成主体/类目/认证备案、虚拟支付开通、道具发布、消息推送配置和一笔小额真单。Android 技术服务费为 1%，iOS 为 12%；Android 通常 T+3 结算，iOS 通常 45–60 天结算。退款由平台订单能力处理，iOS 退款由用户向 App Store 申请。
