import { useCompare } from '@/context/CompareContext';
import { Scale } from 'lucide-react';

interface CompareButtonProps {
  universityId: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function CompareButton({
  universityId,
  size = 'sm',
  className = '',
}: CompareButtonProps) {
  const { isInCompare, toggleCompare, compareIds } = useCompare();
  const active = isInCompare(universityId);
  const isFull = compareIds.length >= 4 && !active;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFull) {
      toggleCompare(universityId);
    }
  };

  const sizeClasses = size === 'sm'
    ? 'text-[11px] gap-1 px-2 py-1'
    : 'text-xs gap-1.5 px-2.5 py-1.5';

  return (
    <button
      onClick={handleClick}
      disabled={isFull}
      title={
        isFull
          ? '最多对比4所院校'
          : active
            ? '移除对比'
            : '加入对比'
      }
      className={`
        inline-flex items-center rounded-md font-medium transition-all duration-200
        ${sizeClasses}
        ${className}
        ${active
          ? 'bg-accent-gold text-bg-deep'
          : isFull
            ? 'bg-bg-elevated text-text-tertiary cursor-not-allowed opacity-50'
            : 'bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-surface'
        }
      `}
    >
      <Scale size={size === 'sm' ? 12 : 14} />
      {active ? '已加入' : '对比'}
    </button>
  );
}
