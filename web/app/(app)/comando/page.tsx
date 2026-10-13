import Link from 'next/link';
import { Topbar } from '@/components/shell/Topbar';
import { PlotMap, type MapPoint } from '@/components/PlotMap';
import { Card } from '@/components/ui/Card';
import { Chip, type Tone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { apiGet, apiGetOr } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';
import type { Alert, EventRow, Farm, Plot, ProofBatch, Task } from '@/lib/types';
import { setAlertStatus, setTaskStatus } from './actions';
import { ScenarioConsole } from '@/components/ScenarioConsole';

export const dynamic = 'force-dynamic';

const RAIL: Record<Alert['severity'], string> = {
  critica: 'border-error',
  alta: 'border-error',
  media: 'border-warning',
  baixa: 'border-primary-container',
};
const PRIORITY_TONE: Record<Task['priority'], Tone> = { critica: 'err', alta: 'err', media: 'warn', baixa: 'idle' };
const PRIORITY_LABEL: Record<Task['priority'], string> = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const STATUS_LABEL: Record<Task['status'], string> = { pendente: 'Pendente', em_progresso: 'Em progresso', concluida: 'Concluída' };
const EVENT_LABEL: Record<string, string> = {
  'inspection.recorded': 'Inspeção registrada',
  'position.reported': 'Posição reportada',
};

function eventSummary(e: EventRow): string {
  const ai = e.payload?.ai as { label?: string; confidence?: number } | undefined;
  if (ai?.label) return `${ai.label.replace(/_/g, ' ')} · ${Math.round((ai.confidence ?? 0) * 100)}%`;
  if (e.payload?.assetId) return `Ativo ${e.payload.assetId}`;
  return e.device_id;
}

function toPoint(e: EventRow): MapPoint | null {
  const loc = e.payload?.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return null;
  const label = (e.payload?.ai?.label as string | undefined) ?? '';
  const tone: MapPoint['tone'] = e.type === 'position.reported' ? 'secondary' : label && label !== 'saudavel' && label !== 'inconclusivo' ? 'error' : label === 'inconclusivo' ? 'warning' : 'primary';
  return { lat: loc.lat, lon: loc.lon, tone, label: `${EVENT_LABEL[e.type] ?? e.type}: ${eventSummary(e)}` };
}

export default async function ComandoPage({ searchParams }: { searchParams: Promise<{ farm?: string }> }) {
  const user = await requireSession();
  const { farm: farmParam } = await searchParams;

  const farms = await apiGet<Farm[]>('/v1/farms');
  const farm = farms.find((f) => f.id === farmParam) ?? farms[0];
  if (!farm) {
    return (
      <>
        <Topbar title="Comando" />
        <div className="px-10 pb-10"><EmptyState title="Nenhuma fazenda disponível">Peça ao administrador para vincular uma fazenda ao seu usuário.</EmptyState></div>
      </>
    );
  }

  const isOperator = user.role === 'operador';
  const canActOnTasks = ['operador','veterinario','gerente','administrador'].includes(user.role);
  const canActOnAlerts = ['veterinario', 'gerente', 'administrador'].includes(user.role);

  const [plots, alerts, tasks, events, batches, scenario] = await Promise.all([
    apiGet<Plot[]>(`/v1/farms/${farm.id}/plots`),
    apiGetOr<Alert[]>(`/v1/alerts?farmId=${farm.id}`, []),
    apiGetOr<Task[]>(`/v1/tasks?farmId=${farm.id}`, []),
    apiGetOr<EventRow[]>(`/v1/events?farmId=${farm.id}`, []), // operador não tem acesso: vira lista vazia
    apiGetOr<ProofBatch[]>('/v1/proof/batches', []),
    apiGetOr<any>(`/v1/demo/farms/${farm.id}`, null),
  ]);

  const openAlerts = alerts.filter((a) => a.status === 'aberto');
  const openTasks = tasks.filter((t) => t.status !== 'concluida');
  const since = Date.now() - 24 * 3600 * 1000;
  const events24h = events.filter((e) => new Date(e.occurred_at).getTime() >= since).length;
  const anchored = batches.filter((b) => b.farm_id === farm.id && b.status === 'ancorado' && b.anchor_mode === 'evm').length;
  const farmBatches = batches.filter((b) => b.farm_id === farm.id);
  const mockBatches = farmBatches.filter((b) => b.anchor_mode === 'mock').length;
  const points = events.map(toPoint).filter((p): p is MapPoint => p !== null).slice(0, 60);

  const subtitle = farm.name;

  const farmSwitch =
    farms.length > 1 ? (
      <div className="flex gap-2 px-10 pb-4">
        {farms.map((f) => (
          <Link key={f.id} href={`/comando?farm=${f.id}`} className={`rounded-sm px-3 py-2 font-display text-label-md uppercase ${f.id === farm.id ? 'bg-primary-tint-1 text-primary' : 'bg-surface-low text-on-surface-variant hover:text-on-surface'}`}>
            {f.name}
          </Link>
        ))}
      </div>
    ) : null;

  const tasksCard = (
    <Card title={isOperator ? 'Tarefas do dia' : 'Tarefas'} action={<Chip tone={openTasks.length ? 'warn' : 'ok'}>{openTasks.length} em aberto</Chip>}>
      {openTasks.length === 0 ? (
        <EmptyState title="Nenhuma tarefa em aberto">As tarefas surgem sozinhas quando uma regra identifica algo que precisa de ação em campo.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {openTasks.slice(0, 8).map((t) => (
            <li key={t.id} className="rounded-md bg-surface-lowest p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-title-md text-on-surface">{t.title}</div>
                  {t.source_event_id && <p className="mt-1 font-mono text-body-sm text-secondary">Evento: {t.source_event_id}</p>}
                  {t.description && <p className="mt-1 max-w-xl text-body-sm text-on-surface-variant">{t.description}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <Chip tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Chip>
                    <Chip tone={t.status === 'em_progresso' ? 'cal' : 'idle'}>{STATUS_LABEL[t.status]}</Chip>
                    <span className="text-body-sm text-on-surface-variant">{timeAgo(t.created_at)}</span>
                  </div>
                </div>
                {canActOnTasks && <form action={setTaskStatus} className="flex gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  {t.status === 'pendente' && (
                    <button name="status" value="em_progresso" type="submit" className="rounded-md border border-secondary/15 px-3 py-2 font-display text-label-md uppercase text-secondary hover:shadow-glow-secondary-hover">Iniciar</button>
                  )}
                  <button name="status" value="concluida" type="submit" className="rounded-md bg-primary-container px-3 py-2 font-display text-label-md uppercase text-on-primary hover:shadow-glow-primary-hover">Concluir</button>
                </form>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {tasks.some((t) => t.status === 'concluida') && <details className="mt-5">
        <summary className="cursor-pointer font-display text-label-md text-primary">Tarefas concluídas ({tasks.filter((t) => t.status === 'concluida').length})</summary>
        <ul className="mt-3 space-y-3">{tasks.filter((t) => t.status === 'concluida').slice(0,8).map((t) => <li key={t.id} className="rounded-md bg-surface-lowest p-4">
          <div className="font-display text-title-md">{t.title}</div><Chip tone="ok">Concluída</Chip>
          {t.source_event_id && <p className="mt-1 font-mono text-body-sm text-secondary">Evento: {t.source_event_id}</p>}
        </li>)}</ul>
      </details>}
    </Card>
  );

  if (isOperator) {
    return (
      <>
        <Topbar title="Tarefas do dia" subtitle={subtitle} />
        {farmSwitch}
        <div className="space-y-8 px-10 pb-10">{tasksCard}</div>
      </>
    );
  }

  return <>
    <Topbar title="Centro de Comando" subtitle={subtitle}/>
    {farmSwitch}
    {scenario && <ScenarioConsole key={farm.id} initial={scenario} farmId={farm.id} farmName={farm.name} user={{name:user.name,role:user.role}} section="comando" canAct={canActOnTasks}/>}
    <div className="terminal-workspace"><div className="terminal-kpis">
      <KpiCard label="Alertas abertos" value={openAlerts.length}/><KpiCard label="Tarefas em aberto" value={openTasks.length}/><KpiCard label="Eventos em 24h" value={events24h}/><KpiCard label="Lotes de prova" value={`${anchored}/${farmBatches.length}`} hint={`${anchored} na blockchain • ${mockBatches} em mock`}/>
    </div><div id="tarefas">{tasksCard}</div>
    <Card title="Alertas registrados pela API">
      {openAlerts.length===0?<p>Nenhum alerta aberto.</p>:openAlerts.map(a=><article key={a.id} className="terminal-feedback">
        <h3>{a.title}</h3><p>{a.severity} • {timeAgo(a.created_at)}</p>
        {canActOnAlerts&&<form action={setAlertStatus} className="terminal-actions"><input type="hidden" name="id" value={a.id}/><button name="status" value="reconhecido">Reconhecer</button><button name="status" value="resolvido">Resolver</button></form>}
      </article>)}
    </Card></div>
  </>;
}
