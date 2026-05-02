import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  hoverable?: boolean;
}

export default function Card({ children, className, header, footer, hoverable }: CardProps) {
  return (
    <div
      className={clsx(
        'card',
        hoverable && 'hover:shadow-card-hover transition-shadow',
        className
      )}
    >
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}