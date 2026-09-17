-- 岗位小程序 建表 SQL (MySQL 8.0)
-- 岗位表
CREATE TABLE IF NOT EXISTS job (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  publish_date      DATE          NULL COMMENT '网申更新日期',
  company_name      VARCHAR(255)  NOT NULL COMMENT '公司名称',
  industry          VARCHAR(255)  NULL COMMENT '标准行业(逗号分隔多值)',
  industry_raw      VARCHAR(255)  NULL COMMENT '原始行业',
  recruit_types     VARCHAR(255)  NULL COMMENT '标准招聘类型(逗号分隔多值)',
  recruit_type_raw  VARCHAR(255)  NULL COMMENT '原始招聘类型',
  company_nature    VARCHAR(255)  NULL COMMENT '标准企业性质',
  company_nature_raw VARCHAR(255) NULL COMMENT '原始企业性质',
  target_raw        VARCHAR(255)  NULL COMMENT '原始招聘对象',
  grade_min         INT           NULL COMMENT '届别下限(不限届=0)',
  grade_max         INT           NULL COMMENT '届别上限(不限届=99)',
  education         VARCHAR(20)   NULL COMMENT '最低学历要求',
  positions         TEXT          NULL COMMENT '招聘岗位(逗号分隔)',
  cities            VARCHAR(255)  NULL COMMENT '工作地点(逗号分隔)',
  notice_url        TEXT          NULL COMMENT '网申公告链接',
  apply_url         TEXT          NULL COMMENT '投递链接',
  deadline          VARCHAR(100)  NULL COMMENT '截止说明(招满即止或日期文本)',
  deadline_date     DATE          NULL COMMENT '截止日期(可解析时)',
  remark            TEXT          NULL COMMENT '备注',
  status            TINYINT       NOT NULL DEFAULT 1 COMMENT '状态(1=上架,0=下架)',
  INDEX idx_industry (industry),
  INDEX idx_recruit_types (recruit_types),
  INDEX idx_nature (company_nature),
  INDEX idx_grade (grade_min, grade_max),
  INDEX idx_cities (cities),
  INDEX idx_deadline_date (deadline_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位信息表';

-- 用户表
CREATE TABLE IF NOT EXISTS app_user (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  openid      VARCHAR(64)  NULL COMMENT '微信openid',
  nickname    VARCHAR(128) NULL COMMENT '昵称',
  avatar      VARCHAR(500) NULL COMMENT '头像',
  preference  TEXT         NULL COMMENT '岗位偏好(JSON筛选项)',
  phone       VARCHAR(20)  NULL COMMENT '手机号(用户手动绑定)',
  password    VARCHAR(128) NULL COMMENT '密码(注册/登录)',
  resume      TEXT         NULL COMMENT '简历信息(JSON)',
  is_vip      TINYINT      DEFAULT 0 COMMENT '是否会员(1=是,0=否)',
  vip_expire  DATETIME     NULL COMMENT '会员到期时间',
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_openid (openid),
  UNIQUE KEY uk_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 收藏表
CREATE TABLE IF NOT EXISTS favorite (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '用户id',
  job_id     BIGINT UNSIGNED NOT NULL COMMENT '岗位id',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_job (user_id, job_id),
  KEY idx_user (user_id),
  KEY idx_job (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位收藏表';

-- 系统配置表
CREATE TABLE IF NOT EXISTS config (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cfg_key   VARCHAR(64)  NOT NULL COMMENT '配置键',
  cfg_value VARCHAR(255) NULL COMMENT '配置值',
  UNIQUE KEY uk_key (cfg_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 用户岗位跟进状态表
CREATE TABLE IF NOT EXISTS job_status (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id            BIGINT UNSIGNED NOT NULL COMMENT '用户id',
  job_id             BIGINT UNSIGNED NOT NULL COMMENT '岗位id',
  main_status        VARCHAR(32)  NOT NULL DEFAULT 'TO_EVALUATE' COMMENT '主状态',
  sub_status         VARCHAR(32)  NULL COMMENT '子状态',
  status_reason      VARCHAR(128) NULL COMMENT '结束原因或状态说明',
  favorite           TINYINT      DEFAULT 0 COMMENT '是否收藏(1=是,0=否)',
  priority           TINYINT      DEFAULT 0 COMMENT '优先级(0=普通,1=重点,2=冲刺,3=保底)',
  plan_id            BIGINT UNSIGNED NULL COMMENT '求职计划id',
  applied_at         DATETIME     NULL COMMENT '投递时间',
  assessment_at      DATETIME     NULL COMMENT '笔试时间',
  interview_at       DATETIME     NULL COMMENT '面试时间',
  offer_deadline     DATETIME     NULL COMMENT 'Offer确认截止时间',
  notes              VARCHAR(500) NULL COMMENT '备注',
  status_changed_at  DATETIME     NULL COMMENT '最近状态变更时间',
  status_created_at  DATETIME     NULL COMMENT '首次进入当前状态时间',
  created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_job (user_id, job_id),
  KEY idx_user_status (user_id, main_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户岗位跟进状态表';

-- 岗位状态历史表
CREATE TABLE IF NOT EXISTS status_history (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NOT NULL COMMENT '用户id',
  job_id           BIGINT UNSIGNED NOT NULL COMMENT '岗位id',
  from_status      VARCHAR(32)  NULL COMMENT '变更前主状态',
  to_status        VARCHAR(32)  NOT NULL COMMENT '变更后主状态',
  from_sub_status  VARCHAR(32)  NULL COMMENT '变更前子状态',
  to_sub_status    VARCHAR(32)  NULL COMMENT '变更后子状态',
  reason           VARCHAR(128) NULL COMMENT '变更原因',
  operator         VARCHAR(32)  NULL COMMENT '操作人',
  remark           VARCHAR(500) NULL COMMENT '备注',
  created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_job (user_id, job_id),
  KEY idx_job (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位状态历史表';
