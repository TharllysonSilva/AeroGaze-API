export type ProofState = { tone: 'ok' | 'warning' | 'error'; title: string; message: string };
type Result = { valid: boolean; status: string; onChain: { checked: boolean; matches?: boolean; revoked?: boolean }; anchor: { mode: string | null } };
export function proofState(result: Result): ProofState {
  if (!result.valid || result.onChain.revoked === true || (result.onChain.checked && result.onChain.matches !== true)) {
    return { tone: 'error', title: 'Falha na verificação', message: 'A prova não confere ou o lote foi revogado. Consulte os detalhes.' };
  }
  if (result.anchor.mode === 'mock') return { tone: 'warning', title: 'Ancoragem simulada', message: 'A raiz existe no banco; este lote não possui prova externa.' };
  if (result.status !== 'ancorado') return { tone: 'warning', title: 'Ancoragem pendente', message: 'A ingestão foi registrada, mas a ancoragem ainda não foi confirmada.' };
  if (!result.onChain.checked || result.onChain.revoked !== false || result.anchor.mode !== 'evm') return { tone: 'warning', title: 'Consulta à rede pendente', message: 'A integridade no banco confere. A rede não pôde ser confirmada nesta consulta; tente novamente.' };
  return { tone: 'ok', title: 'Íntegro e conferido na rede', message: 'Os dados recalculados conferem com a raiz ancorada e o lote não foi revogado.' };
}
