-- 求职计划功能迁移 SQL (MySQL 8.0)
-- 1. 建 plan 表
CREATE TABLE IF NOT EXISTS plan (
  id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id                 BIGINT UNSIGNED NOT NULL COMMENT '用户id',
  plan_name               VARCHAR(100) NOT NULL COMMENT '计划名称',
  recruitment_stage       VARCHAR(50)  NULL COMMENT '招聘阶段',
  start_date              DATE         NULL COMMENT '计划开始日期',
  end_date                DATE         NULL COMMENT '计划结束日期',
  target_positions        VARCHAR(255) NULL COMMENT '目标岗位(逗号分隔)',
  target_cities           VARCHAR(255) NULL COMMENT '目标城市(逗号分隔)',
  target_apply_count      INT          DEFAULT 0 COMMENT '目标投递数',
  target_interview_count  INT          DEFAULT 0 COMMENT '目标面试数',
  target_offer_count      INT          DEFAULT 0 COMMENT '目标Offer数',
  status                  VARCHAR(20)  NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/IN_PROGRESS/PAUSED/COMPLETED/ARCHIVED',
  is_active               TINYINT      DEFAULT 0 COMMENT '是否当前进行中(1=是)',
  created_at              DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  KEY idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='求职计划表';

-- 2. 为每个已有关注岗位的用户创建默认「2026秋招计划」（进行中）
INSERT INTO plan (user_id, plan_name, recruitment_stage, status, is_active, created_at, updated_at)
SELECT DISTINCT js.user_id, '2026秋招计划', '2026秋招', 'IN_PROGRESS', 1, NOW(), NOW()
FROM job_status js
WHERE js.user_id NOT IN (SELECT user_id FROM plan);

-- 3. 把已有岗位归入该用户的进行中计划
UPDATE job_status js
JOIN plan p ON p.user_id = js.user_id AND p.status = 'IN_PROGRESS'
SET js.plan_id = p.id
WHERE js.plan_id IS NULL;
