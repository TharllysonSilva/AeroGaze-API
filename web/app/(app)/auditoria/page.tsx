import Link from 'next/link';
import { Topbar } from '@/components/shell/Topbar';
import { Card } from '@/components/ui/Card';
import { Chip, type Tone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiGet } from '@/lib/api';
import { dateTime, shortHash } from '@/lib/format';
import { requireRole } from '@/lib/session';
import type { ProofBatch } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS: Record<ProofBatch['status'], { tone: Tone; label: string }> = {
  ancorado: { tone: 'ok', label: 'Ancorado' },
  pendente: { tone: 'warn', label: 'Pendente' },
  falhou: { tone: 'err', label: 'Falhou' },
};

export default async function AuditoriaPage() {
  await requireRole(['gerente', 'auditor', 'administrador']);
  const batches = await apiGet<ProofBatch[]>('/v1/proof/batches');
  const simulated = batches.some((b) => b.anchor_mode === 'mock');

  return (
    <>
      <Topbar title="Auditoria" subtitle="Prova de integridade dos eventos de campo" />
      <div className="space-y-8 px-10 pb-10">
        {simulated && (
          <div className="rounded-md bg-surface-low p-6 text-body-md text-on-surface-variant">
            <span className="font-display text-label-md uppercase text-warning">Ancoragem simulada</span>
            <p className="mt-2 max-w-3xl">
              Alguns lotes foram ancorados em modo de demonstração: a raiz de Merkle existe apenas no banco da API, sem registro em blockchain.
              Eles servem para mostrar o fluxo, mas ainda não são prova para terceiros.
            </p>
          </div>
        )}

        <Card title="Lotes de prova" action={<Chip tone="idle">{batches.length} lotes</Chip>}>
          {batches.length === 0 ? (
            <EmptyState title="Nenhum lote ainda">O worker cria um lote quando há eventos suficientes ou quando o tempo máximo de espera passa.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-md">
              <table className="w-full border-collapse bg-surface-lowest text-left">
                <thead>
                  <tr className="bg-surface-container font-display text-label-sm uppercase text-on-surface-variant">
                    {['Criado', 'Status', 'Eventos', 'Raiz de Merkle', 'Modo', 'Recibo', ''].map((h) => (
                      <th key={h} className="px-4 py-4 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b, i) => (
                    <tr key={b.id} className={i % 2 === 0 ? 'bg-surface-low' : 'bg-surface-lowest'}>
                      <td className="px-4 py-4 text-body-md">{dateTime(b.created_at)}</td>
                      <td className="px-4 py-4">
                        <Chip tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Chip>
                        {b.status !== 'ancorado' && b.last_error && <div className="mt-1 max-w-[220px] text-body-sm text-on-surface-muted">{b.last_error}</div>}
                      </td>
                      <td data-metric className="px-4 py-4 text-body-md">{b.leaf_count}</td>
                      <td className="px-4 py-4 font-mono text-body-sm text-primary-container">{shortHash(b.merkle_root)}</td>
                      <td className="px-4 py-4 text-body-md">{b.anchor_mode === 'evm' ? `Rede ${b.chain_id}` : b.anchor_mode === 'mock' ? 'Simulado' : '—'}</td>
                      <td className="px-4 py-4 font-mono text-body-sm text-secondary-container">{b.tx_ref ? shortHash(b.tx_ref, 6) : '—'}</td>
                      <td className="px-4 py-4 text-right">
                        <Link href={`/verificar/${b.id}`} className="font-display text-label-md uppercase text-secondary hover:text-secondary-container">Verificar</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
