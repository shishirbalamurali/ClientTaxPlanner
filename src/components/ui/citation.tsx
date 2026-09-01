import { formatDate } from '@/lib/format';
import { getAuthorities } from '@/lib/research/authorities';

export function Citation({ id }: { id: string }) {
  const [authority] = getAuthorities([id]);
  if (!authority) return null;
  return (
    <a
      href={authority.sourceUrl}
      target="_blank"
      rel="noreferrer noopener"
      className="text-accent-2 underline decoration-rule-strong underline-offset-2 hover:decoration-accent-2"
    >
      {authority.citation}
    </a>
  );
}

export function CitationList({ ids, label = 'Source' }: { ids: readonly string[]; label?: string }) {
  const authorities = getAuthorities(ids);
  if (authorities.length === 0) return null;
  return (
    <div className="text-[11.5px] leading-relaxed text-ink-3">
      <span className="eyebrow mr-2">{label}</span>
      {authorities.map((authority, index) => (
        <span key={authority.id}>
          {index > 0 && <span className="text-ink-4"> · </span>}
          <a
            href={authority.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent-2 underline decoration-rule-strong underline-offset-2 hover:decoration-accent-2"
          >
            {authority.citation}
          </a>
          <span className="text-ink-4"> ({authority.governmentSource}, verified {formatDate(authority.lastVerified)})</span>
        </span>
      ))}
    </div>
  );
}
