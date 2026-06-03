import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authApi, type User } from '@/services/api';
import { KeyRound, RefreshCw } from 'lucide-react';

const ROLE_LABEL: Record<User['role'], string> = {
  admin: '系统管理员',
  staff: '教务',
  supervisor: '指导老师',
  teacher: '任课教师',
  student: '学生',
};

export default function AdminAccountsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [securityNote, setSecurityNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await authApi.getUsers();
      setUsers(res.users);
      setSecurityNote(res.securityNote);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRoleChange = async (u: User, role: User['role']) => {
    if (u.role === 'student') return;
    try {
      await authApi.updateUser(u.id, { role });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新失败');
    }
  };

  const submitReset = async () => {
    if (!resetUser || !newPassword.trim()) return;
    if (newPassword.length < 6) {
      alert('新密码至少 6 位');
      return;
    }
    const uname = resetUser.username;
    try {
      setSaving(true);
      await authApi.resetUserPassword(resetUser.id, newPassword.trim());
      setResetUser(null);
      setNewPassword('');
      alert(`已重置账号「${uname}」的密码，请将新口令通过安全渠道告知对方。`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '重置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>账号与权限</CardTitle>
          <CardDescription>
            查看全校登录账号、调整教务/指导老师角色，以及重置密码。学生账号由「添加/删除学生」自动维护。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
            <p className="font-medium mb-1">安全说明</p>
            <p className="text-amber-900/90 leading-relaxed">{securityNote || '…'}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">全部账号</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">加载中…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>显示名</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>密码提示</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">{u.username}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>
                        {u.role === 'student' ? (
                          <span>{ROLE_LABEL[u.role]}</span>
                        ) : (
                          <Select
                            value={u.role}
                            onValueChange={(v) => handleRoleChange(u, v as User['role'])}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
                              <SelectItem value="staff">{ROLE_LABEL.staff}</SelectItem>
                              <SelectItem value="supervisor">{ROLE_LABEL.supervisor}</SelectItem>
                              <SelectItem value="teacher">{ROLE_LABEL.teacher}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px] text-xs text-muted-foreground leading-snug">
                        {u.password_hint || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setResetUser(u);
                            setNewPassword('');
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5 mr-1" />
                          重置密码
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              账号：{resetUser?.username}。设置新密码后请通过线下/加密渠道告知本人，勿在聊天工具中长期使用弱口令。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="npw">新密码（至少 6 位）</Label>
            <Input
              id="npw"
              type="text"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="输入新密码"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetUser(null)}>
              取消
            </Button>
            <Button type="button" onClick={submitReset} disabled={saving}>
              {saving ? '保存中…' : '确认重置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
