export type Tone = 'ok' | 'cal' | 'warn' | 'err' | 'idle';

const TONES: Record<Tone, string> = {
  ok: 'bg-primary-tint-3 text-primary-container',
  cal: 'bg-secondary-container/10 text-secondary-container',
  warn: 'bg-warning/10 text-warning',
  err: 'bg-error-tint text-error',
  idle: 'bg-surface-high text-on-surface-muted',
};

/** Status sempre com texto (nunca só cor). Raio de 4 px, sem pílula. */
export function Chip({ tone = 'idle', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-sm px-2 py-[3px] font-display text-label-sm uppercase ${TONES[tone]}`}>
      {children}
    </span>
  );
}
