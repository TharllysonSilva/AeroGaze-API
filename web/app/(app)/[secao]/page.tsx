import { notFound } from 'next/navigation';
import { Topbar } from '@/components/shell/Topbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { NAV } from '@/lib/nav';
import { requireSession } from '@/lib/session';
import { apiGet } from '@/lib/api';
import { ScenarioConsole } from '@/components/ScenarioConsole';
import type { Farm } from '@/lib/types';

/** Terminais do cenário compartilhado; telemetria e imagens identificadas como fictícias. */
export default async function SecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = await params;
  const item = NAV.find((n) => n.href === `/${secao}` && n.scenario);
  if (!item) notFound();

  const user = await requireSession();
  if (!item.roles.includes(user.role)) notFound();
  const farms=await apiGet<Farm[]>('/v1/farms');
  const farm=farms[0];
  if(!farm)return <EmptyState title="Nenhuma fazenda autorizada">Vincule uma fazenda à conta.</EmptyState>;
  const scenario=await apiGet<any>(`/v1/demo/farms/${farm.id}`);

  return (
    <>
      <Topbar title={item.label} subtitle={farm.name} />
      <div className="pb-10">
        <ScenarioConsole key={farm.id} initial={scenario} farmId={farm.id} farmName={farm.name} user={{name:user.name,role:user.role}} section={secao} canAct={user.role!=='auditor'}/>
      </div>
    </>
  );
}
