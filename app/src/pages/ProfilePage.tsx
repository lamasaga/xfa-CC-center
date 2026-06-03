import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

function roleLabel(role: string | undefined) {
  switch (role) {
    case 'admin':
      return '系统管理员';
    case 'staff':
      return '教务';
    case 'supervisor':
      return '指导老师';
    case 'teacher':
      return '任课教师';
    case 'student':
      return '学生';
    default:
      return role || '—';
  }
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwOk, setPwOk] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwOk('');
    if (newPassword !== confirmPassword) {
      setPwError('两次输入的新密码不一致');
      return;
    }
    setPwLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPwOk('密码已更新。当前登录仍有效；下次登录请使用新密码。');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>个人资料</CardTitle>
          <CardDescription>
            {isAdmin
              ? '当前登录账号信息（只读）。管理员重置他人密码请在「系统管理」账号页操作。'
              : '当前登录账号信息（只读）。登录密码可在下方「修改密码」中自助更新。'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">用户名</span>
            <span className="font-medium">{user?.username}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">姓名</span>
            <span className="font-medium">{user?.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">角色</span>
            <span className="font-medium">{roleLabel(user?.role)}</span>
          </div>
        </CardContent>
      </Card>

      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>修改密码</CardTitle>
            <CardDescription>新密码至少 8 个字符。请勿与教务告知的初始密码长期相同。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {pwError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{pwError}</AlertDescription>
                </Alert>
              )}
              {pwOk && (
                <Alert className="border-emerald-500/40 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription>{pwOk}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="current-password">当前密码</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={pwLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={pwLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">确认新密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={pwLoading}
                />
              </div>
              <Button type="submit" disabled={pwLoading}>
                {pwLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交中…
                  </>
                ) : (
                  '保存新密码'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
