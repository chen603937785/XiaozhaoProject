-- 简历资料库迁移 SQL（第一阶段核心表）

-- 1. 用户基本资料
CREATE TABLE IF NOT EXISTS candidate_profile (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL,
  chinese_name      VARCHAR(50)  NULL COMMENT '中文姓名',
  english_name      VARCHAR(50)  NULL COMMENT '英文姓名',
  gender            VARCHAR(10)  NULL COMMENT '性别',
  birth_date        VARCHAR(20)  NULL COMMENT '出生日期',
  phone             VARCHAR(20)  NULL COMMENT '手机号',
  email             VARCHAR(100) NULL COMMENT '邮箱',
  id_type           VARCHAR(20)  NULL COMMENT '证件类型',
  id_number         VARCHAR(50)  NULL COMMENT '证件号码',
  current_city      VARCHAR(50)  NULL COMMENT '所在城市',
  native_place      VARCHAR(50)  NULL COMMENT '籍贯',
  political_status  VARCHAR(20)  NULL COMMENT '政治面貌',
  ethnicity         VARCHAR(20)  NULL COMMENT '民族',
  wechat            VARCHAR(50)  NULL COMMENT '微信号',
  emergency_contact VARCHAR(50)  NULL COMMENT '紧急联系人',
  emergency_phone   VARCHAR(20)  NULL COMMENT '紧急联系人电话',
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户基本资料表';

-- 2. 简历版本
CREATE TABLE IF NOT EXISTS resume (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NOT NULL,
  resume_name      VARCHAR(100) NULL COMMENT '简历名称',
  target_position  VARCHAR(100) NULL COMMENT '目标岗位',
  target_cities    VARCHAR(200) NULL COMMENT '期望城市',
  expected_salary  VARCHAR(50)  NULL COMMENT '期望薪资',
  available_date   VARCHAR(20)  NULL COMMENT '到岗时间',
  self_evaluation  TEXT         NULL COMMENT '自我评价',
  is_default       TINYINT      DEFAULT 0 COMMENT '是否默认简历',
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='简历版本表';

-- 3. 教育经历
CREATE TABLE IF NOT EXISTS resume_education (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  resume_id       BIGINT UNSIGNED NOT NULL,
  school_name     VARCHAR(100) NULL COMMENT '学校名称',
  major           VARCHAR(100) NULL COMMENT '专业',
  education_level VARCHAR(20)  NULL COMMENT '学历',
  degree          VARCHAR(20)  NULL COMMENT '学位',
  start_date      VARCHAR(20)  NULL COMMENT '入学时间',
  end_date        VARCHAR(20)  NULL COMMENT '毕业时间',
  gpa             VARCHAR(20)  NULL COMMENT 'GPA',
  courses         VARCHAR(500) NULL COMMENT '主修课程',
  description     TEXT         NULL COMMENT '描述',
  sort_order      INT          DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_resume (resume_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教育经历表';

-- 4. 实习/工作经历
CREATE TABLE IF NOT EXISTS resume_experience (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  resume_id     BIGINT UNSIGNED NOT NULL,
  company_name  VARCHAR(100) NULL COMMENT '公司名称',
  position      VARCHAR(100) NULL COMMENT '职位',
  city          VARCHAR(50)  NULL COMMENT '城市',
  start_date    VARCHAR(20)  NULL COMMENT '开始时间',
  end_date      VARCHAR(20)  NULL COMMENT '结束时间',
  is_current    TINYINT      DEFAULT 0 COMMENT '是否在职',
  description   TEXT         NULL COMMENT '工作内容',
  achievements  TEXT         NULL COMMENT '工作成果',
  sort_order    INT          DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_resume (resume_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='实习/工作经历表';

-- 5. 项目经历
CREATE TABLE IF NOT EXISTS resume_project (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NOT NULL,
  resume_id        BIGINT UNSIGNED NOT NULL,
  project_name     VARCHAR(100) NULL COMMENT '项目名称',
  role             VARCHAR(50)  NULL COMMENT '项目角色',
  start_date       VARCHAR(20)  NULL COMMENT '开始时间',
  end_date         VARCHAR(20)  NULL COMMENT '结束时间',
  background       TEXT         NULL COMMENT '项目背景',
  responsibilities TEXT         NULL COMMENT '个人职责',
  achievements     TEXT         NULL COMMENT '项目成果',
  skills           VARCHAR(200) NULL COMMENT '使用技术',
  sort_order       INT          DEFAULT 0,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_resume (resume_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目经历表';

-- 6. 专业技能
CREATE TABLE IF NOT EXISTS resume_skill (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  resume_id  BIGINT UNSIGNED NOT NULL,
  skill_name VARCHAR(100) NULL COMMENT '技能名称',
  level      VARCHAR(20)  NULL COMMENT '熟练度',
  years      VARCHAR(20)  NULL COMMENT '使用年限',
  sort_order INT          DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_resume (resume_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专业技能表';

-- 7. 语言能力
CREATE TABLE IF NOT EXISTS resume_language (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  resume_id  BIGINT UNSIGNED NOT NULL,
  language   VARCHAR(50) NULL COMMENT '语言',
  level      VARCHAR(20) NULL COMMENT '熟练程度',
  score      VARCHAR(50) NULL COMMENT '成绩',
  sort_order INT         DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_resume (resume_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='语言能力表';
