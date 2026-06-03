import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="max-w-lg space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>系统设置</CardTitle>
          <CardDescription>管理员预留入口。后续可在此配置学期、权限、备份策略等。</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          当前版本暂无额外系统项，数据与账号仍由后台数据库与登录会话管理。
        </CardContent>
      </Card>
    </div>
  );
}
