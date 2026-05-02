import clsx from 'clsx';

interface SkeletonProps {
  variant?: 'text' | 'title' | 'avatar' | 'rect';
  width?: string;
  height?: string;
  className?: string;
  lines?: number;
}

export default function Skeleton({
  variant = 'text',
  width,
  height,
  className,
  lines = 1,
}: SkeletonProps) {
  if (variant === 'title') {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={clsx('skeleton h-6 rounded w-1/2', width)} />
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return <div className={clsx('skeleton h-10 w-10 rounded-full', className)} />;
  }

  if (variant === 'rect') {
    return (
      <div
        className={clsx('skeleton rounded', className)}
        style={{ width, height }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx('skeleton h-4 rounded', width || (i === lines - 1 ? 'w-3/4' : 'w-full'))}
        />
      ))}
    </div>
  );
}