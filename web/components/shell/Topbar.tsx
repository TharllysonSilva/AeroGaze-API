import { API_URL } from '@/lib/api';
import { Chip } from '@/components/ui/Chip';

async function apiStatus(): Promise<'ok' | 'down'> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    return res.ok ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

export async function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const status = await apiStatus();
  return (
    <header className="terminal-topbar flex h-topbar items-center justify-between gap-6 px-10">
      <div>
        <h1 className="font-display text-display-md uppercase text-on-surface">{title}</h1>
        {subtitle && <p className="font-display text-label-md uppercase text-on-surface-variant">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display text-label-sm uppercase text-on-surface-variant">Status do sistema</span>
        {status === 'ok' ? <Chip tone="ok">API online</Chip> : <Chip tone="err">API indisponível</Chip>}
      </div>
    </header>
  );
}
