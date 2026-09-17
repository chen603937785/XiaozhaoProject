# 校招岗位筛选小程序

基于微信小程序的校招/实习岗位筛选工具。数据源为《27届暑假日常实习+秋招+春招网申汇总表.xlsx》（5772 条岗位）。

## 项目结构

```
校招/
├── data/                    # 数据产物
│   ├── jobs.csv             # 清洗后的岗位数据(主产物)
│   ├── jobs.json            # 同等 JSON
│   ├── schema.sql           # 建表 SQL
│   ├── insert.sql           # 数据插入 SQL(5772条)
│   ├── meta.json            # 筛选项字典
│   └── clean_report.txt     # 清洗报告
├── scripts/                 # 数据清洗脚本
│   ├── clean_data.py        # Excel -> 干净 CSV/JSON
│   └── gen_insert_sql.py    # CSV -> INSERT SQL
├── backend/                 # Spring Boot 后端
└── miniprogram/             # 微信小程序前端
```

## 技术栈

- **后端**: Spring Boot 2.7 + MyBatis-Plus 3.5 + MySQL 8 + Hutool(JWT/HTTP)
- **前端**: 微信小程序原生
- **数据清洗**: Python (openpyxl)

## 一、数据准备与导入

### 1. 清洗数据（可选，数据已生成）

Excel 更新后重新清洗：

```bash
cd 校招
python3 scripts/clean_data.py          # Excel -> data/jobs.csv
python3 scripts/gen_insert_sql.py      # CSV -> data/insert.sql
```

### 2. 建库并导入

```bash
# 建库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS campus_job DEFAULT CHARSET utf8mb4;"
# 建表
mysql -u root -p campus_job < data/schema.sql
# 导入数据
mysql -u root -p campus_job < data/insert.sql
```

## 二、后端启动

### 1. 修改配置

编辑 `backend/src/main/resources/application.yml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3307/campus_job?...   # 端口按实际 MySQL 端口(本机 MxSrvs 为 3307)
    username: root
    password: ""                  # 本机 MxSrvs 的 root 默认无密码
wechat:
  appid: "你的小程序appid"       # 微信小程序 appid
  secret: "你的小程序secret"      # 微信小程序 secret
  mock-openid: true              # 开发阶段保持 true, 上线改 false
```

### 2. 启动

用 IDEA 打开 `backend` 目录（会自动识别 Maven 项目），运行 `JobApplication`。

或命令行（需先安装 Maven）：

```bash
cd backend
# 国内网络建议加 -s settings-aliyun.xml 使用阿里云镜像加速依赖下载
mvn -s settings-aliyun.xml spring-boot:run
```

启动后接口地址: `http://localhost:8080`

## 三、小程序前端启动

1. 用**微信开发者工具**打开 `miniprogram` 目录
2. 修改 `miniprogram/utils/config.js` 中的 `BASE_URL` 为后端地址
3. 在开发者工具右上角「详情 → 本地设置」勾选 **「不校验合法域名」**
4. 编译运行

> `project.config.json` 中的 `appid` 为 `touristappid`（游客模式），正式开发请替换为你的真实 appid。

## 四、API 一览

| 方法 | 路径 | 说明 | 需登录 |
|------|------|------|--------|
| POST | `/api/auth/login` | 微信登录换 token | 否 |
| GET | `/api/jobs` | 岗位列表+筛选 | 否 |
| GET | `/api/jobs/{id}` | 岗位详情 | 否 |
| GET | `/api/meta/filters` | 筛选项字典 | 否 |
| POST | `/api/favorites` | 收藏岗位 | 是 |
| DELETE | `/api/favorites/{jobId}` | 取消收藏 | 是 |
| GET | `/api/favorites` | 收藏列表 | 是 |
| GET | `/api/favorites/status/{jobId}` | 是否已收藏 | 是 |

### 筛选参数 (GET /api/jobs)

```
keyword=华为              # 关键字搜索
recruitType=秋招,暑期实习  # 招聘类型多选
nature=央国企,外企         # 企业性质多选
industry=互联网,金融       # 行业多选
grade=27                  # 届别(单值)
city=上海,北京             # 城市多选
education=本科            # 学历(单值)
sort=deadline|publish     # 排序
page=1&size=20            # 分页
```

## 五、上线注意

1. 后端需部署到有 **HTTPS** 域名 + ICP 备案的服务器
2. 小程序后台配置 request 合法域名
3. `application.yml` 中 `mock-openid` 改为 `false`，填入真实 appid/secret
4. `jwt.secret` 修改为随机强密钥
5. 修改 `utils/config.js` 的 `BASE_URL` 为线上 HTTPS 地址
