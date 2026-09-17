-- 兑换码功能迁移 SQL

-- 兑换码表
CREATE TABLE IF NOT EXISTS redeem_code (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(32)  NOT NULL COMMENT '兑换码',
  plan_type  VARCHAR(20)  NOT NULL COMMENT 'MONTH/QUARTER/YEAR',
  days       INT          NOT NULL COMMENT '会员天数',
  status     VARCHAR(20)  NOT NULL DEFAULT 'UNUSED' COMMENT 'UNUSED/USED/EXPIRED',
  used_by    BIGINT UNSIGNED NULL COMMENT '使用用户id',
  used_at    DATETIME     NULL COMMENT '使用时间',
  expired_at DATETIME     NULL COMMENT '兑换码过期时间',
  remark     VARCHAR(100) NULL COMMENT '备注',
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='兑换码表';

-- 兑换记录表
CREATE TABLE IF NOT EXISTS redeem_record (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(32) NOT NULL COMMENT '兑换码',
  user_id     BIGINT UNSIGNED NOT NULL COMMENT '用户id',
  plan_type   VARCHAR(20) NOT NULL COMMENT 'MONTH/QUARTER/YEAR',
  days        INT         NOT NULL COMMENT '兑换天数',
  redeemed_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  KEY idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='兑换记录表';
