import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-x-auto', className)}>{children}</div>;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn('w-full text-[12.5px]', className)}>{children}</table>;
}

export function Th({
  children,
  className,
  numeric,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      {...rest}
      className={cn(
        'border-b border-rule-strong px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-4',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  numeric,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      {...rest}
      className={cn(
        'border-b border-rule px-3 py-1.5 align-top',
        numeric && 'tnum text-right',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function TotalRow({ children }: { children: ReactNode }) {
  return <tr className="bg-canvas-2 font-semibold text-ink">{children}</tr>;
}
