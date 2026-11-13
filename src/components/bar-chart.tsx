export function BarChart({
  rows,
  label,
}: {
  rows: { label: string; value: number }[];
  label: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="flex h-36 items-end gap-1" role="img" aria-label={label}>
      {rows.map((row) => (
        <div key={row.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
          <div
            className="w-full rounded-t bg-primary"
            style={{ height: row.value === 0 ? "0%" : `${Math.max(8, (row.value / max) * 100)}%` }}
            title={`${row.label}: ${row.value}`}
          />
          <span className="mt-1 truncate text-center text-[10px] text-muted-foreground">{row.label.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function SplitBar({
  parts,
  label,
}: {
  parts: { label: string; value: number; className: string }[];
  label: string;
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={label}>
        {parts.map((part) => (
          <div key={part.label} className={part.className} style={{ width: `${(part.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-1">
            <span className={`inline-block size-2 rounded-full ${part.className}`} />
            {part.label} · {part.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
