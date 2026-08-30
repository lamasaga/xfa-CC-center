import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ConfirmedGradeBadgeProps {
  className?: string;
}

export function ConfirmedGradeBadge({ className }: ConfirmedGradeBadgeProps) {
  return (
    <Badge
      variant="outline"
      title="成绩已确定，不再进行预测"
      className={cn(
        'gap-1 border-emerald-200/80 bg-emerald-50/70 px-1.5 py-0 text-[10px] font-medium text-emerald-700 shadow-none',
        className
      )}
    >
      <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
      <span>已确定</span>
    </Badge>
  );
}
