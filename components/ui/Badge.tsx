import { cn } from '@/lib/cn';

type Variant = 'default' | 'accent' | 'warning' | 'danger' | 'success' | 'muted';

const VARIANTS: Record<Variant, string> = {
  default: 'bg-surface-elev text-foreground border border-border',
  accent: 'bg-accent/15 text-accent border border-accent/30',
  warning: 'bg-warning/15 text-warning border border-warning/30',
  danger: 'bg-danger/15 text-danger border border-danger/30',
  success: 'bg-success/15 text-success border border-success/30',
  muted: 'bg-muted text-muted-foreground border border-border',
};

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
