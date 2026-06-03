# A-Level升学指导中心 - 修复思路文档

> 本文档记录从 PostgreSQL 迁移到 SQLite 过程中的关键 Bug 修复思路，包括根因分析、修复方案及预防措施。

---

## 1. 核心 Bug 修复：URLSearchParams 处理 undefined

### 🔴 问题现象
学生列表页面显示"暂无学生数据"，但数据库中明明有学生记录。

### 🔍 根因分析

**问题链路：**
```
StudentList.tsx
  ↓ 调用 studentApi.getAll({ grade: undefined, search: undefined })
  ↓ api.ts 中 new URLSearchParams({ grade: undefined })
  ↓ URLSearchParams 将 undefined 转为字符串 "undefined"
  ↓ 请求 URL: /api/students?grade=undefined&search=undefined
  ↓ 后端执行筛选: WHERE grade = 'undefined'
  ↓ 结果: 无匹配数据
```

**关键代码问题：**
```typescript
// 修复前的问题代码
const qs = new URLSearchParams(filtered).toString();
// 输入: { grade: undefined }
// 输出: "grade=undefined"  ❌
```

**URLSearchParams 的陷阱：**
```javascript
new URLSearchParams({ key: undefined }).toString()
// 结果: "key=undefined" （字符串 undefined，不是空值）
```

### ✅ 修复方案

**新增 buildQuery 函数，主动过滤无效参数：**
```typescript
// api.ts
function buildQuery(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  
  // 主动过滤 undefined 和空字符串
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      filtered[key] = value;
    }
  }
  
  const qs = new URLSearchParams(filtered).toString();
  return qs ? `?${qs}` : '';
}
```

**统一修复三处 API：**
```typescript
// 学生 API
export const studentApi = {
  getAll: (params?: { grade?: string; status?: string; search?: string }) => {
    const query = buildQuery(params);  // ✅ 使用 buildQuery
    return api.get<StudentWithStats[]>(`/students${query}`);
  },
  // ...
};

// 课程 API 和院校 API 同样修复
```

### 💡 经验总结

| 坑点 | 说明 | 预防方法 |
|------|------|---------|
| URLSearchParams 自动转字符串 | undefined → "undefined" | 始终前置过滤参数 |
| TypeScript 类型不保护运行时 | 编译通过不代表逻辑正确 | 关键路径添加单元测试 |
| 隐式类型转换 | JavaScript 的弱类型陷阱 | 使用严格相等判断 (===) |

---

## 2. 安全与配置问题修复

### 2.1 JWT_SECRET 不一致

**问题：**
- `server/middleware/auth.js` 和 `server/config.js` 各自定义 JWT_SECRET
- 可能导致 token 验证失败

**修复：**
```javascript
// middleware/auth.js
const { JWT_SECRET } = require('../config');  // 统一从 config 读取
```

### 2.2 密码字段泄露

**问题：**
```javascript
// 修复前 - 返回了完整用户对象，包含 password
router.get('/me', authenticateToken, async (req, res) => {
  const user = await dbAsync.findById('users', req.user.id);
  res.json(user);  // ❌ 包含 password 字段
});
```

**修复：**
```javascript
// 修复后 - 解构剔除 password
const { password, ...safeUser } = user;
res.json(safeUser);  // ✅ 安全
```

### 2.3 启动信息错误

**问题：** 迁移到 SQLite 后，启动日志仍显示 "Database: PostgreSQL"

**修复：** 更新 `server/index.js` 中的启动信息
```javascript
console.log(`
  Database: SQLite          ✅ 已更新
`);
```

---

## 3. NaN 运算修复（除以零防护）

### 🔴 问题现象
控制台出现 `Received NaN for the children attribute` 警告，部分组件显示异常。

### 🔍 根因分析

**问题模式：**
```typescript
// 问题代码示例
const avgScore = unitGrades.reduce((sum, u) => sum + u.score, 0) / unitGrades.length;
// 当 unitGrades = [] 时: 0 / 0 = NaN
```

**受影响的 6 个组件：**

| 组件 | 计算场景 | 修复方式 |
|------|---------|---------|
| `GoalsAndActions.tsx` | 匹配度百分比 | `(matchCount / total) \|\| 0` |
| `CompetencyAnalysis.tsx` | 竞争力平均分 | 空数组时返回默认值 |
| `KeyMetricsPanel.tsx` | 关键指标统计 | `Math.round(value) \|\| 0` |
| `GradeComparisonPanel.tsx` | 成绩对比 | 空数据防护 |
| `UniversityMatchPanel.tsx` | 匹配度计算 | 除零保护 |
| `StudentRadarChart.tsx` | 雷达图维度值 | 空数组时返回 0 |

### ✅ 修复模式

**统一修复范式：**
```typescript
// 修复前
const average = scores.reduce((a, b) => a + b, 0) / scores.length;

// 修复后 - 三元表达式
const average = scores.length > 0 
  ? scores.reduce((a, b) => a + b, 0) / scores.length 
  : 0;

// 或 - 短路运算符
const average = (scores.reduce((a, b) => a + b, 0) / scores.length) || 0;
```

**数据存在性检查：**
```typescript
// 防御式编程
if (!data || !data.courses || data.courses.length === 0) {
  return <EmptyState />;
}
```

---

## 4. 数据迁移优化

### 4.1 防止误删数据库

**问题：** `init-db.js` 在数据库已存在时会自动删除重建，可能导致数据丢失。

**修复：** 改为安全模式
```javascript
if (fs.existsSync(DB_PATH)) {
  console.log('Database already exists at:', DB_PATH);
  console.log('To reinitialize, delete the file manually first.');
  process.exit(0);  // ✅ 安全退出，不删除
}
```

### 4.2 年级格式兼容

**问题：** 历史数据中存在 "A22024级" 等不规范格式，需要兼容处理。

**修复：** `migrate-data.js` 增强映射逻辑
```javascript
const gradeMap = { 
  'AS': '2025级', 
  'A2': '2024级', 
  'IG': '2026级',
  'A22024级': '2024级',  // 新增兼容
  'A22025级': '2025级'   // 新增兼容
};

// 同时兼容 student_courses 中的 grade/score 字段
```

---

## 5. 问题排查方法论

### 5.1 学生列表不显示的排查路径

```
1. 浏览器 DevTools → Network
   ↓ 检查 /api/students 请求
   ↓ 查看 Query String Parameters
   ↓ 发现 grade=undefined&search=undefined ❌

2. 后端日志
   ↓ 查看实际执行的 SQL
   ↓ 发现 WHERE grade = 'undefined'

3. 根因确认
   ↓ URLSearchParams 将 undefined 转为字符串
```

### 5.2 NaN 问题排查

```
1. 控制台警告定位组件
   ↓ Received NaN for the children attribute
   
2. 在该组件搜索 "/" 运算符
   ↓ 找到除法运算点
   
3. 检查被除数是否可能为 0
   ↓ 数组长度检查
```

---

## 6. 预防措施

### 6.1 代码规范

**API 参数处理规范：**
```typescript
// ✅ 所有 API 查询参数必须经过 buildQuery 处理
const query = buildQuery(params);

// ✅ buildQuery 必须过滤以下值：
// - undefined
// - null
// - 空字符串 ""
// - NaN
```

**数值计算规范：**
```typescript
// ✅ 除法运算前检查除数
const result = divisor !== 0 ? dividend / divisor : 0;

// ✅ 或使用 Lodash 的 mean 等安全函数
import { mean } from 'lodash';
const avg = mean(scores) || 0;
```

### 6.2 类型安全增强

**URLSearchParams 类型增强：**
```typescript
// 定义严格的参数类型
type QueryParams = Record<string, string | number | boolean | undefined>;

// 构建查询时强制过滤
function buildQuery(params: QueryParams): string {
  const validEntries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '' && v !== null);
  return new URLSearchParams(Object.fromEntries(validEntries)).toString();
}
```

### 6.3 单元测试建议

**关键测试用例：**
```typescript
describe('buildQuery', () => {
  it('should filter undefined values', () => {
    expect(buildQuery({ grade: undefined })).toBe('');
  });
  
  it('should filter empty strings', () => {
    expect(buildQuery({ search: '' })).toBe('');
  });
  
  it('should keep valid values', () => {
    expect(buildQuery({ grade: '2024级' })).toBe('?grade=2024级');
  });
});
```

---

## 7. 修复清单汇总

### 7.1 文件修改清单

| 文件 | 修改类型 | 修改内容 |
|------|---------|---------|
| `src/services/api.ts` | Bug 修复 | 新增 buildQuery，修复 URLSearchParams 问题 |
| `server/middleware/auth.js` | 配置修复 | JWT_SECRET 统一从 config.js 读取 |
| `server/routes/auth.js` | 安全修复 | GET /me 剔除 password 字段 |
| `server/index.js` | 文案更新 | 启动信息改为 SQLite |
| `GoalsAndActions.tsx` | Bug 修复 | 空数组除零防护 |
| `CompetencyAnalysis.tsx` | Bug 修复 | 空数组除零防护 |
| `KeyMetricsPanel.tsx` | Bug 修复 | 空数组除零防护 |
| `GradeComparisonPanel.tsx` | Bug 修复 | 空数组除零防护 |
| `UniversityMatchPanel.tsx` | Bug 修复 | 空数组除零防护 |
| `StudentRadarChart.tsx` | Bug 修复 | 空数组除零防护 |
| `server/init-db.js` | 安全优化 | 存在性检查，防止误删 |
| `server/migrate-data.js` | 兼容优化 | 年级格式兼容，字段映射增强 |

### 7.2 问题分类统计

| 类别 | 数量 | 严重程度 |
|------|------|---------|
| 数据查询 Bug | 1 | 🔴 严重 |
| 安全漏洞 | 2 | 🟠 高 |
| 计算错误 | 6 | 🟡 中 |
| 配置问题 | 1 | 🟢 低 |
| 数据迁移 | 2 | 🟢 低 |

---

## 8. 技术债务与未来优化

### 8.1 待完善项

1. **单元测试覆盖**
   - buildQuery 函数测试
   - API 错误处理测试
   - 组件空状态测试

2. **TypeScript 严格模式**
   - 开启 strictNullChecks
   - 消除隐式 any

3. **错误边界**
   - 添加 React Error Boundary
   - 统一错误上报

### 8.2 监控建议

```typescript
// 建议添加监控
if (Number.isNaN(result)) {
  console.error('NaN detected in calculation', { component, data });
  // 或上报到监控系统
  reportError(new Error('NaN in render'));
}
```

---

**文档版本:** v2.0  
**最后更新:** 2026-03-15  
**修复者:** 开发者  
**审核者:** AI Assistant
