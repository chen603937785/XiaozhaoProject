# -*- coding: utf-8 -*-
"""
将 data/jobs.csv 生成 data/insert.sql (批量 INSERT 语句)
用法: python3 scripts/gen_insert_sql.py
"""
import csv

CSV_PATH = '/Users/xiaohua/Documents/obsidian知识库/大橙子的知识库/校招/data/jobs.csv'
OUT_PATH = '/Users/xiaohua/Documents/obsidian知识库/大橙子的知识库/校招/data/insert.sql'

# 与 schema.sql 列顺序一致(不含自增 id)
COLUMNS = [
    'publish_date', 'company_name', 'industry', 'industry_raw',
    'recruit_types', 'recruit_type_raw', 'company_nature', 'company_nature_raw',
    'target_raw', 'grade_min', 'grade_max', 'education',
    'positions', 'cities', 'notice_url', 'apply_url',
    'deadline', 'deadline_date', 'remark',
]

# 整数字段
INT_COLUMNS = {'grade_min', 'grade_max'}


def quote_str(v):
    """字符串转义: 单引号 -> ''，反斜杠 -> \\"""
    if v is None or v == '':
        return 'NULL'
    s = str(v).replace('\\', '\\\\').replace("'", "''")
    return f"'{s}'"


def quote_date(v):
    if v is None or v == '':
        return 'NULL'
    return f"'{v}'"


def quote_int(v):
    if v is None or v == '' or v == 'None':
        return 'NULL'
    return str(int(v))


def main():
    with open(CSV_PATH, encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))

    col_list = ', '.join(COLUMNS)
    BATCH = 500  # 每批 500 条
    lines = []
    lines.append('-- 岗位数据插入 (由 scripts/gen_insert_sql.py 生成)')
    lines.append('-- 注意: 需先执行 schema.sql 建表')
    lines.append('SET NAMES utf8mb4;')
    lines.append('')

    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        values = []
        for r in batch:
            vals = []
            for col in COLUMNS:
                v = r.get(col, '')
                if col in INT_COLUMNS:
                    vals.append(quote_int(v))
                elif col in ('publish_date', 'deadline_date'):
                    vals.append(quote_date(v))
                else:
                    vals.append(quote_str(v))
            values.append('(' + ', '.join(vals) + ')')
        lines.append(f'INSERT INTO job ({col_list}) VALUES')
        lines.append(',\n'.join(values) + ';')
        lines.append('')

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f'生成 {OUT_PATH}, 共 {len(rows)} 条记录')


if __name__ == '__main__':
    main()
