# study-app 调研数据说明

## 目录用途

　　本目录存放**人工整理/调研阶段的原始 JSON**，供维护与核对使用。浏览器运行时**不直接读取**此处文件，而是加载构建产物：

| 运行时（`public/`） | 调研稿（`research/`） |
|---------------------|------------------------|
| `universities_data.json` | `us_top30.json`、`uk_top20.json`、`commonwealth_universities.json`、`europe_art_universities.json` |
| `third_party_summary.json` | `third_party_data.json`（键名略有不同，见下） |

　　更新流程：在 `research/` 或外部调研后整理 → 同步/生成 `public/*.json` → 在 `study-app` 目录执行 `npm run build` → 随主站部署脚本打入 `app/study-dist`。

## 生活成本

- **页面**：`/living-cost`（生活成本）
- **数据字段**：`cities_living_costs`（运行时 JSON）
- **主要来源**：**Numbeo**（条目中 `source` 多为 `Numbeo 2025`）
- **内容**：城市生活成本指数、租金、餐饮等参考值，用于横向对比，非实时报价

## 薪资与就业

- **页面**：`/career`（薪资就业）
- **数据字段**：`salaries`、`salary_by_major`、`employment` 等
- **主要来源**（见 `third_party_summary.json` → `metadata.sources`）：
  - **PayScale**（如 College Salary Report）
  - **NACE**、**HESA**、**QILT**
  - **College Scorecard**、**Common Data Set**
  - 英国 **NSS**、**Whatuni**；评价类 **Niche**
- **说明**：为第三方公开统计的汇总参考，不代表本校官方就业报告

## 院校卡片与排名

- **页面**：院校浏览（`/`）
- **数据**：`universities_data.json` 中每校的 `ranking`（`qs` / `us_news` / `the`）及学费、录取等
- **来源**：调研 JSON 与公开排名信息整理；卡片默认展示 **QS** 排名；详情弹窗可并列显示多榜

## 键名对照（第三方汇总）

| `research/third_party_data.json` | `public/third_party_summary.json` |
|----------------------------------|-----------------------------------|
| `living_costs` | `cities_living_costs` |
| `graduate_salaries` | `salaries` |

## 采集元数据

　　汇总文件的 `metadata.data_collection_date` 当前为 **2025-01**；具体条目以各对象内 `source` 字段为准。
