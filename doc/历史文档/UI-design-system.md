# 前端 UI 设计说明（升学指导中心）

## 目标

整体气质：**可信、安静、偏教育机构**——避免高饱和「互联网渐变」，用暖白底、学院蓝绿主色与清晰层级，让顾问与教务长时间使用也不刺眼。

## 技术落点

| 项目 | 说明 |
|------|------|
| 设计令牌 | `app/src/index.css` 中 `:root` / `.dark` 的 CSS 变量（HSL 分量，无 `hsl()` 包裹） |
| Tailwind | `app/tailwind.config.js` 中颜色均带 `<alpha-value>`，支持 `bg-primary/10` 等透明度写法 |
| 字体 | `Plus Jakarta Sans`（界面）+ `Source Serif 4`（品牌/姓名等标题点缀），在 `app/index.html` 引入 |
| 组件 | shadcn `Card`、`Button` 等依赖上述令牌，尽量少用裸 `blue-*`，优先 `primary` / `muted` / `foreground` |

## 主色与背景

- **背景**：略带暖意的纸感灰白（`--background: 40 33% 98%`），区别于冷灰 `slate-50`。
- **主色 `--primary`**：蓝绿色相、中等饱和度（约 `201 55% 38%`），用于导航激活态、关键链接、数据强调。
- **语义色**：成功/警告/危险仍用 `emerald` / `amber` / `red` 系列，不与主色抢戏。

## 布局壳层

- **顶栏**：`bg-card/90` + `backdrop-blur-md` + 轻阴影，与内容区分离但不厚重。
- **年级条**：浅 `muted` 底 + 选中项用实心 `primary` 按钮样式，状态一目了然。
- **页脚**：低对比说明文案，强调校内使用场景。

## 维护建议

- 新增页面时优先使用 `bg-background`、`text-foreground`、`text-muted-foreground`、`border-border`。
- 需要品牌色强调时用 `primary` 及其透明度变体，避免再引入新的高饱和色环。
- 若调整主色，只改 `index.css` 变量即可带动按钮、环、选中态等全局联动。
