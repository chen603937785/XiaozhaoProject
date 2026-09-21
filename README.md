# 校招求职工具

面向 27 届校招 / 实习的岗位筛选与求职跟进工具。岗位数据来自网申汇总表（清洗后约 5772 条），支持微信小程序和 Tauri 桌面端，桌面端可内置打开网申页并半自动填表。

线上 API：https://my88ai.com

## 项目结构

```
校招/
├── data/                      # 数据产物与迁移 SQL
│   ├── jobs.csv / jobs.json   # 清洗后的岗位数据
│   ├── schema.sql             # 主库表结构
│   ├── insert.sql             # 岗位导入
│   ├── meta.json              # 筛选项字典
│   ├── 岗位数据清洗规范.md
│   └── migration_*.sql        # 计划 / 待办 / 简历 / 兑换码等增量
├── scripts/                   # Excel / 飞书数据清洗
├── backend/                   # Spring Boot 后端 + 管理后台
├── miniprogram/               # 微信小程序
├── campus-job-desktop/        # Tauri 2 + Vue 3 桌面端
└── .github/workflows/         # macOS / Windows 桌面端打包
```

## 技术栈

- **后端**：Spring Boot 2.7、MyBatis-Plus 3.5、MySQL 8、Hutool（JWT / HTTP）
- **小程序**：微信小程序原生
- **桌面端**：Tauri 2、Vue 3、Vite；macOS 内嵌 WKWebView，Windows 用独立 WebView2 窗口
- **数据清洗**：Python（openpyxl）

## 功能概览

| 能力 | 小程序 | 桌面端 |
|---|---|---|
| 岗位筛选 / 搜索 / 分页 | ✓ | ✓ |
| 与我匹配（偏好条件） | ✓ | ✓ |
| 关注岗位 + 状态跟进 | 收藏 | ✓ 完整状态机 |
| 求职计划 | | ✓ |
| 待办日历 | | ✓ |
| 简历资料库 + 多份简历 | 简单 JSON | ✓ 分节维护 |
| 内置打开网申/投递页 + 自动填写 | | ✓ |
| 会员 / 兑换码 | ✓ | ✓ |
| 管理后台 | 后端静态页 /admin | |

---

## 一、数据准备与导入

Excel 更新后重新清洗：

```bash
cd 校招
python3 scripts/clean_data.py          # Excel -> data/jobs.csv
python3 scripts/gen_insert_sql.py      # CSV -> data/insert.sql
```

建库导入：

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS campus_job DEFAULT CHARSET utf8mb4;"
mysql -u root -p campus_job < data/schema.sql
mysql -u root -p campus_job < data/insert.sql
```

后续增量功能表见 data/migration_plan.sql、migration_todo.sql、migration_resume.sql、migration_redeem.sql。

清洗规则（行业 18 类、招聘类型 12 类、企业性质 6 类、城市归一化）见 data/岗位数据清洗规范.md。增量去重键：company_name + positions + publish_date。

---

## 二、后端

编辑 backend/src/main/resources/application.yml：数据源、微信 appid/secret、JWT、mock-openid（开发 true，上线 false）。

```bash
cd backend
mvn -s settings-aliyun.xml spring-boot:run
```

默认 http://localhost:8080 。管理后台：http://localhost:8080/admin/ 。

### 用户 API

| 方法 | 路径 | 说明 | 登录 |
|---|---|---|---|
| POST | /api/auth/login | 微信登录 | 否 |
| POST | /api/auth/register | 手机号注册 | 否 |
| POST | /api/auth/password-login | 密码登录 | 否 |
| GET | /api/jobs | 岗位列表 + 筛选 | 否 |
| GET | /api/jobs/{id} | 岗位详情 | 否 |
| GET | /api/companies | 公司列表 | 否 |
| GET | /api/meta/filters | 筛选项字典 | 否 |
| GET | /api/config | 前端开关配置 | 否 |
| GET | /api/version/latest | 桌面端最新版本 | 否 |
| GET/POST | /api/user/preference | 求职偏好 | 是 |
| GET | /api/user/info | 用户信息 | 是 |
| POST | /api/favorites 等 | 收藏 | 是 |
| GET/POST/PUT/DELETE | /api/job-status/* | 关注与投递状态 | 是 |
| CRUD | /api/plans | 求职计划 | 是 |
| CRUD | /api/todos | 待办 | 是 |
| CRUD | /api/profile /api/resumes | 简历资料库 | 是 |
| POST | /api/redeem | 兑换会员 | 是 |

GET /api/jobs 筛选参数：keyword、recruitType、nature、industry、grade、city、education、sort=deadline|publish、page、size。

### 管理 API（/admin）

登录、统计、用户 VIP、岗位上下架 / 导入、系统配置、版本发布、兑换码、文件上传、客服二维码。

---

## 三、微信小程序

1. 用微信开发者工具打开 miniprogram
2. 修改 miniprogram/utils/config.js 的 BASE_URL
3. 详情 → 本地设置，勾选「不校验合法域名」
4. project.config.json 里游客 appid 为 touristappid，正式开发换成真实 appid

页面：岗位列表、公司、详情、收藏、我的、偏好。

---

## 四、桌面端

目录 campus-job-desktop/，产品名「校招岗位筛选」，当前版本 **0.1.6**。

```bash
cd campus-job-desktop
npm install
npm run tauri dev
```

打包：

```bash
npx tauri build
```

或推送 v* tag / 手动跑 GitHub Actions Build Desktop App，产出 macOS universal dmg 和 Windows NSIS 安装包。

侧边栏：工作台、岗位库、与我匹配、关注岗位、岗位跳转、求职计划、待办日历、简历管理、系统设置。

### 内置浏览器

点击「网申公告 / 投递地址」或在「岗位跳转」输入网址：

- **macOS**：主窗口内嵌子 webview，页签切换显示/隐藏
- **Windows**：同样用页签，不弹新窗口。打开网页时主界面收成顶栏，网页铺在下面（两层 WebView2 不能重叠，否则会白屏卡死）。创建失败时回退到系统浏览器

系统设置可勾选「始终使用电脑浏览器打开网页」（此时自动填写不可用）。

自动填写：把默认简历拍平后注入页面，由 campus-job-desktop/src-tauri/autofill.js 在目标页填表。

---

## 五、上线注意

1. 后端需 HTTPS 域名 + ICP 备案；小程序配置 request 合法域名
2. application.yml 中 mock-openid=false，填入真实微信 appid/secret，jwt.secret 换成强密钥
3. 桌面端 API 在 campus-job-desktop/src/api/index.js 的 BASE_URL
4. 小程序 utils/config.js 的 BASE_URL 改为线上 HTTPS
