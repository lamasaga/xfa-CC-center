import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { academicApi } from '@/services/api';
import { AlertTriangle, ShieldCheck, Users } from 'lucide-react';

type AuditRow = { id: string; actor_name?: string; actor_username?: string; action: string; entity_type: string; entity_id?: string; outcome: string; created_at: string; request_id?: string };

export default function SecurityAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let cancelled = false; academicApi.getAuditEvents().then((items) => { if (!cancelled) setRows(items as unknown as AuditRow[]); }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  return <div className="flex flex-col gap-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex flex-col gap-1"><p className="text-sm font-medium text-primary">权限与可追溯性</p><h1 className="text-2xl font-semibold tracking-tight">安全与审计</h1><p className="text-sm text-muted-foreground">关键开课、选课、分班、排课与发布操作保留人员、时间、对象和请求编号。</p></div><Button variant="outline" asChild><Link to="/admin/accounts"><Users data-icon="inline-start" />管理账号职责</Link></Button></div>{error && <Alert variant="destructive"><AlertTriangle /><AlertTitle>审计记录加载失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}<Alert><ShieldCheck /><AlertTitle>会话安全已升级</AlertTitle><AlertDescription>新登录使用服务器端可撤销会话与 HttpOnly Cookie；写操作需要同源 CSRF 校验，密码变更会撤销其它会话。</AlertDescription></Alert>{loading ? <Skeleton className="h-96 w-full" /> : <div className="overflow-hidden rounded-lg border bg-card"><Table><TableHeader><TableRow><TableHead>时间</TableHead><TableHead>操作人</TableHead><TableHead>动作</TableHead><TableHead>对象</TableHead><TableHead>结果</TableHead><TableHead>请求编号</TableHead></TableRow></TableHeader><TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">暂无关键操作记录</TableCell></TableRow> : rows.map((row) => <TableRow key={row.id}><TableCell>{new Date(row.created_at).toLocaleString('zh-CN')}</TableCell><TableCell>{row.actor_name || row.actor_username || '系统'}</TableCell><TableCell className="font-mono text-xs">{row.action}</TableCell><TableCell><div className="flex flex-col gap-0.5"><span>{row.entity_type}</span><span className="max-w-48 truncate font-mono text-xs text-muted-foreground">{row.entity_id || '—'}</span></div></TableCell><TableCell><Badge variant={row.outcome === 'success' ? 'secondary' : 'destructive'}>{row.outcome}</Badge></TableCell><TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground">{row.request_id || '—'}</TableCell></TableRow>)}</TableBody></Table></div>}</div>;
}
