const COLORS = { primary: 'text-primary', secondary: 'text-secondary-container', error: 'text-error', warning: 'text-warning' };

export function KpiCard({
  label,
  value,
  hint,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  hint?: React.ReactNode;
  tone?: keyof typeof COLORS;
}) {
  return (
    <div className="rounded-md bg-surface-low p-6">
      <div className="font-display text-label-sm uppercase text-on-surface-variant">{label}</div>
      <div data-metric className={`mt-2 font-display text-display-md ${COLORS[tone]}`}>
        {value}
      </div>
      {hint && <div className="mt-2 text-body-sm text-on-surface-variant">{hint}</div>}
    </div>
  );
}
