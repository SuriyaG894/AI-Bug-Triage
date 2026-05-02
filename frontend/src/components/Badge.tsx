import clsx from 'clsx';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'severity' | 'status' | 'source';
  color?: 'critical' | 'high' | 'medium' | 'low' | 'open' | 'in_progress' | 'resolved' | 'closed' | 'internal' | 'external';
  className?: string;
}

export default function Badge({ label, variant = 'default', color, className }: BadgeProps) {
  const baseClass = 'badge';
  
  const variantClass = clsx({
    'bg-gray-100 text-gray-800': variant === 'default',
    'badge-severity-critical': variant === 'severity' && color === 'critical',
    'badge-severity-high': variant === 'severity' && color === 'high',
    'badge-severity-medium': variant === 'severity' && color === 'medium',
    'badge-severity-low': variant === 'severity' && color === 'low',
    'badge-status-open': variant === 'status' && color === 'open',
    'badge-status-in_progress': variant === 'status' && color === 'in_progress',
    'badge-status-resolved': variant === 'status' && color === 'resolved',
    'badge-status-closed': variant === 'status' && color === 'closed',
    'badge-source-internal': variant === 'source' && color === 'internal',
    'badge-source-external': variant === 'source' && color === 'external',
  });

  return (
    <span className={clsx(baseClass, variantClass, className)}>
      {label}
    </span>
  );
}