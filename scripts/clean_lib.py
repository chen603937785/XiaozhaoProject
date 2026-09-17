# -*- coding: utf-8 -*-
"""
统一清洗模块：导出所有归一化函数 + 单条/批量清洗入口。

自动化同步脚本（飞书多维表格 → MySQL 增量）直接 import 本模块即可复用全部清洗逻辑，
与 scripts/clean_data.py 的结果完全一致。仅依赖 Python 标准库。

用法：
    import clean_lib

    # 单条清洗（飞书表一行 13 列原始值 -> job 表 19 字段 dict）
    row = clean_lib.clean_row(
        publish_date, company_name, industry, recruit_types, company_nature,
        target, education, positions, cities, notice_url, apply_url, deadline, remark
    )

    # 批量清洗（自动做同名公司企业性质众数归一化）
    rows = [ (publish, company, ...), ... ]  # 每条 13 元组
    jobs = clean_lib.clean_batch(rows)
"""
import datetime

# ---- 从 clean_data.py 复用（行业/类型/性质/届别/学历/截止/岗位）----
from clean_data import (
    normalize_industry,
    normalize_recruit_types,
    normalize_nature,
    normalize_company_nature,
    parse_grades,
    normalize_education,
    parse_deadline,
    normalize_positions,
    INDUSTRY_ORDER,
    RECRUIT_TYPES,
    NATURE_ORDER,
)

# ---- 从 normalize_cities.py 复用（城市归一化，新版完整白名单）----
from normalize_cities import normalize_city

__all__ = [
    'clean_row', 'clean_batch',
    'normalize_industry', 'normalize_recruit_types', 'normalize_nature',
    'normalize_company_nature', 'parse_grades', 'normalize_education',
    'parse_deadline', 'normalize_positions', 'normalize_city',
    'INDUSTRY_ORDER', 'RECRUIT_TYPES', 'NATURE_ORDER',
]

# 字段顺序（与 job 表/schema.sql 一致，不含自增 id 和 status）
FIELDS = [
    'publish_date', 'company_name', 'industry', 'industry_raw',
    'recruit_types', 'recruit_type_raw', 'company_nature', 'company_nature_raw',
    'target_raw', 'grade_min', 'grade_max', 'education',
    'positions', 'cities', 'notice_url', 'apply_url',
    'deadline', 'deadline_date', 'remark',
]


def _fmt_publish(publish):
    """发布日期 -> 'YYYY-MM-DD' 或 ''"""
    if isinstance(publish, datetime.datetime):
        return publish.strftime('%Y-%m-%d')
    if isinstance(publish, datetime.date):
        return publish.strftime('%Y-%m-%d')
    if publish:
        return str(publish)[:10]
    return ''


def _norm_cities(cities_raw):
    """城市字段归一化：拆分 -> 逐个 normalize_city -> 去重"""
    out = []
    for c in (cities_raw or '').split(','):
        nc = normalize_city(c.strip())
        if nc and nc not in out:
            out.append(nc)
    return ','.join(out)


def clean_row(publish_date, company_name, industry, recruit_types, company_nature,
              target, education, positions, cities, notice_url, apply_url, deadline, remark):
    """清洗一条飞书表原始记录（13 列），返回 job 表 19 字段 dict。

    参数顺序与原始 Excel/飞书表列顺序一致。
    """
    industry_std, industry_raw = normalize_industry(industry)
    recruit_std, recruit_raw = normalize_recruit_types(recruit_types)
    nature_std, nature_raw = normalize_nature(company_nature)
    grade_min, grade_max, target_raw = parse_grades(target)
    deadline_text, deadline_date = parse_deadline(deadline)

    return {
        'publish_date': _fmt_publish(publish_date),
        'company_name': str(company_name).strip() if company_name else '',
        'industry': industry_std,
        'industry_raw': industry_raw,
        'recruit_types': recruit_std,
        'recruit_type_raw': recruit_raw,
        'company_nature': nature_std,
        'company_nature_raw': nature_raw,
        'target_raw': target_raw,
        'grade_min': grade_min,
        'grade_max': grade_max,
        'education': normalize_education(education),
        'positions': normalize_positions(positions),
        'cities': _norm_cities(cities),
        'notice_url': str(notice_url).strip() if notice_url else '',
        'apply_url': str(apply_url).strip() if apply_url else '',
        'deadline': deadline_text,
        'deadline_date': deadline_date,
        'remark': str(remark).strip() if remark else '',
    }


def clean_batch(rows):
    """批量清洗：rows 是 13 元组列表，返回 job 字段 dict 列表。

    自动做「同名公司企业性质众数归一化」。
    """
    jobs = [clean_row(*r) for r in rows]
    # 同名公司众数归一化（按 company_name 聚合，修正 company_nature）
    from collections import Counter, defaultdict
    counter = defaultdict(Counter)
    for j in jobs:
        if j['company_name']:
            counter[j['company_name']][j['company_nature']] += 1
    priority = ['央国企', '事业单位', '社会机构/公益组织', '民企', '外企/合资', '其他']
    for j in jobs:
        name = j['company_name']
        if not name:
            continue
        cnt = counter[name]
        if len(cnt) <= 1:
            continue
        max_cnt = max(cnt.values())
        candidates = [n for n, c in cnt.items() if c == max_cnt]
        majority = next((n for n in priority if n in candidates), candidates[0])
        j['company_nature'] = majority
    return jobs
