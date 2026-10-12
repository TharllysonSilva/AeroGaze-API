import { proofState } from '@/lib/proof-state';
import { Logo } from '@/components/Logo';
import { Chip } from '@/components/ui/Chip';
import { apiPublicGet } from '@/lib/api';
import { dateTime, shortHash } from '@/lib/format';
import type { VerifyResult } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verificação de integridade · AeroGaze' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <span className="font-display text-label-md uppercase text-on-surface-variant">{label}</span>
      <span className="text-right text-body-md text-on-surface">{children}</span>
    </div>
  );
}

/** Página PÚBLICA (destino do QR code). Não mostra nenhum dado de evento, só a prova de integridade. */
export default async function VerificarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let result: VerifyResult | null = null;
  let unavailable = false;
  try { result = UUID.test(id) ? await apiPublicGet<VerifyResult>(`/v1/verify/${id}`) : null; }
  catch { unavailable = true; }
  const state = result ? proofState(result) : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <Logo size={48} />
          <div>
            <div className="font-display text-title-lg text-primary">AeroGaze AI</div>
            <div className="font-display text-label-sm uppercase text-on-surface-variant">Verificação de integridade</div>
          </div>
        </div>

        {!result ? (
          <div className="rounded-md bg-surface-low p-8">
            <h1 className="font-display text-headline-md text-on-surface">{unavailable ? 'Verificação temporariamente indisponível' : 'Lote não encontrado'}</h1>
            <p className="mt-3 text-body-md text-on-surface-variant">{unavailable ? 'A API não respondeu. Nenhuma conclusão sobre integridade foi feita; tente novamente.' : 'Confira o código do QR ou tente novamente em instantes.'}</p>
          </div>
        ) : (
          <div className="rounded-md bg-surface-low p-8">
            <div className={`rounded-md p-6 ${state?.tone === 'ok' ? 'bg-primary-tint-1' : state?.tone === 'error' ? 'bg-error-tint' : 'bg-surface-lowest'}`}>
              <div className="font-display text-label-md uppercase text-on-surface-variant">Resultado</div>
              <h1 className={`mt-1 font-display text-headline-lg ${state?.tone === 'ok' ? 'text-primary' : state?.tone === 'error' ? 'text-error' : 'text-warning'}`}>
                {state?.title}
              </h1>
              <p className="mt-2 text-body-md text-on-surface-variant">
                {state?.message}
              </p>
            </div>

            <div className="mt-6">
              <Row label="Eventos no lote"><span data-metric>{result.leafCount}</span></Row>
              <Row label="Raiz de Merkle"><span className="font-mono text-body-sm text-primary-container">{shortHash(result.merkleRoot)}</span></Row>
              <Row label="Status">
                <Chip tone={result.status === 'ancorado' ? 'ok' : result.status === 'pendente' ? 'warn' : 'err'}>{result.status}</Chip>
              </Row>
              <Row label="Registro na rede">
                {result.onChain.checked ? (result.onChain.revoked ? 'Lote revogado' : result.onChain.matches ? 'Confere com a rede' : 'Não confere com a rede') : result.anchor.mode === 'mock' ? 'Não aplicável (simulado)' : 'Ainda não consultado'}
              </Row>
              {result.anchor.anchoredAt && <Row label="Ancorado em">{dateTime(result.anchor.anchoredAt)}</Row>}
              {result.anchor.txRef && <Row label="Recibo"><span className="font-mono text-body-sm text-secondary-container">{shortHash(result.anchor.txRef, 6)}</span></Row>}
            </div>

            {result.note && <p className="mt-4 rounded-sm bg-surface-lowest p-4 text-body-sm text-warning">{result.note}</p>}
            <p className="mt-6 text-body-sm text-on-surface-muted">
              A blockchain demonstra que o histórico não foi alterado depois da ancoragem. A autenticidade física do fato depende também da identidade do dispositivo, da validação e de auditoria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
