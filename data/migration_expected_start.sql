-- 关注岗位预计开始时间字段
ALTER TABLE job_status ADD COLUMN expected_start_at DATETIME NULL COMMENT '预计开始时间' AFTER offer_deadline;
