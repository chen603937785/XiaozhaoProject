-- 微信小程序虚拟支付订单
CREATE TABLE IF NOT EXISTS virtual_payment_order (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  out_trade_no VARCHAR(32) NOT NULL,
  wx_order_id VARCHAR(64) NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  openid VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  plan_type VARCHAR(16) NOT NULL,
  goods_price INT NOT NULL COMMENT '分',
  quantity INT NOT NULL DEFAULT 1,
  duration_days INT NOT NULL COMMENT '下单时锁定会员天数',
  reported TINYINT NOT NULL DEFAULT 0 COMMENT '微信已确认发货',
  last_checked_at DATETIME NULL,
  attach VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  delivered_at DATETIME NULL,
  UNIQUE KEY uk_out_trade_no (out_trade_no),
  UNIQUE KEY uk_wx_order_id (wx_order_id),
  KEY idx_vp_user (user_id),
  KEY idx_vp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信虚拟支付订单';
