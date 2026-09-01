'use client';

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-[3px] border border-rule-strong bg-canvas px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:border-ink-4 hover:text-ink"
    >
      {label}
    </button>
  );
}
