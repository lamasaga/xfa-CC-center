import { useMemo, useState } from "react"
import {
  BookOpenCheck,
  CalendarCheck2,
  Download,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  Layers3,
  Link2,
  Users,
} from "lucide-react"

type ReferenceScore = {
  studentName: string
  season: string
  subject: string
  score: string
  examType: "IG" | "校内" | "A-Level"
}

const referenceScores: ReferenceScore[] = [
  { studentName: "陈思远", season: "2025 Spring", subject: "Math", score: "A*", examType: "A-Level" },
  { studentName: "陈思远", season: "Grade 9 Term 2", subject: "Physics", score: "92", examType: "校内" },
  { studentName: "李安琪", season: "2024 Nov", subject: "Biology", score: "A", examType: "IG" },
  { studentName: "王奕辰", season: "2025 Jun", subject: "Economics", score: "B", examType: "A-Level" },
]

const scoreTemplate = [
  { item: "平时分", weight: "20%" },
  { item: "周测", weight: "15%" },
  { item: "月测", weight: "15%" },
  { item: "期中", weight: "25%" },
  { item: "期末", weight: "25%" },
]

const blocks = [
  { title: "学生档案", desc: "统一管理基础档案、家校联系、升学标签。", icon: Users },
  { title: "升学参考成绩", desc: "支持 IG/校内/A Level 多考季成绩录入与查询。", icon: FileSpreadsheet },
  { title: "启赋高中成绩单", desc: "行政班、学科班、评语审核、期中期末导出。", icon: BookOpenCheck },
  { title: "生涯管理", desc: "目标大学、行动计划、风险预警与里程碑跟踪。", icon: CalendarCheck2 },
]

export default function App() {
  const [nameFilter, setNameFilter] = useState("")
  const [seasonFilter, setSeasonFilter] = useState("")
  const [subjectFilter, setSubjectFilter] = useState("")

  const filteredScores = useMemo(() => {
    return referenceScores.filter((row) => {
      const byName = nameFilter ? row.studentName.includes(nameFilter) : true
      const bySeason = seasonFilter ? row.season.toLowerCase().includes(seasonFilter.toLowerCase()) : true
      const bySubject = subjectFilter ? row.subject.toLowerCase().includes(subjectFilter.toLowerCase()) : true
      return byName && bySeason && bySubject
    })
  }, [nameFilter, seasonFilter, subjectFilter])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">启赋高中 · StudentApp</p>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">学生信息管理系统（前端展示版）</h1>
          </div>
          <a
            href="http://127.0.0.1:5173"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Link2 className="h-4 w-4" />
            打开升学指导系统（app）
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1280px] gap-6 px-6 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">模块导航</h2>
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li key={b.title} className="rounded-md border bg-background p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <b.icon className="h-4 w-4 text-primary" />
                  {b.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{b.desc}</p>
              </li>
            ))}
          </ul>
        </aside>

        <section className="space-y-6">
          <article className="rounded-lg border bg-card p-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              升学参考成绩
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              教务可录入九年级 IG、九年级校内考试、启赋阶段各考季 A-Level 成绩，并按姓名/考季/科目查询。
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                placeholder="按学生姓名筛选"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                placeholder="按考季筛选"
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value)}
              />
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                placeholder="按科目筛选"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2">学生</th>
                    <th className="px-3 py-2">考季</th>
                    <th className="px-3 py-2">科目</th>
                    <th className="px-3 py-2">成绩</th>
                    <th className="px-3 py-2">类型</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScores.map((row, idx) => (
                    <tr key={`${row.studentName}-${idx}`} className="border-t">
                      <td className="px-3 py-2">{row.studentName}</td>
                      <td className="px-3 py-2">{row.season}</td>
                      <td className="px-3 py-2">{row.subject}</td>
                      <td className="px-3 py-2 font-semibold">{row.score}</td>
                      <td className="px-3 py-2">{row.examType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-lg border bg-card p-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <GraduationCap className="h-5 w-5 text-primary" />
              启赋高中成绩单（MVP展示）
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border bg-background p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <Layers3 className="h-4 w-4 text-primary" />
                  班级与角色
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>教务创建行政班、学科班</li>
                  <li>学科老师录入平时/周测/月测/期中/期末成绩</li>
                  <li>学科负责人查看分布与异常名单</li>
                </ul>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <Filter className="h-4 w-4 text-primary" />
                  权重计算（后台规则占位）
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {scoreTemplate.map((item) => (
                    <li key={item.item} className="flex justify-between rounded bg-muted/50 px-2 py-1">
                      <span>{item.item}</span>
                      <span className="font-medium">{item.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-md border bg-background p-4">
              <p className="font-semibold">评语与审核流程（展示）</p>
              <p className="mt-1 text-sm text-muted-foreground">
                行政班填写班主任评语，学科班填写学科评语，中层领导审核后归档到期中/期末成绩单。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">填写班主任评语</button>
                <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">填写学科评语</button>
                <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">中层审核</button>
                <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">
                  <Download className="h-4 w-4" />
                  导出期中/期末成绩单
                </button>
              </div>
            </div>
          </article>

          <article className="rounded-lg border bg-card p-5">
            <h3 className="text-lg font-semibold">学生管理与生涯管理（扩展模块）</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[
                "学生档案（联系方式、家校沟通、状态）",
                "学业预警（缺勤、低分、进度滞后）",
                "目标大学与申请时间线",
                "活动与竞赛履历",
                "行动计划与导师跟进",
                "与 app 升学系统数据映射占位",
              ].map((item) => (
                <div key={item} className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}
