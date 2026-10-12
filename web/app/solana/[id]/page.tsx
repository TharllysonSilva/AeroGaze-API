import { notFound } from 'next/navigation';
import { apiPublicGet } from '@/lib/api';
export const dynamic='force-dynamic';
export default async function SolanaProofPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
  const result=await apiPublicGet<any>(`/v1/solana/verify/${id}`);
  const valid=result?.valid===true&&result?.checked===true&&result?.network==='solana-devnet';
  return <main className="mx-auto max-w-2xl space-y-6 p-8"><h1 className="font-display text-3xl">AeroGaze • Recibo Solana Devnet</h1><div className={`rounded-md border p-6 ${valid?'border-primary text-primary':'border-warning text-warning'}`}><h2 className="text-xl">{valid?'Recibo confirmado e conferido na rede':'Recibo ainda sem confirmação verificável'}</h2><p>{result?.status??'Consulta indisponível'}</p></div>{result?.simulated&&<p>Este recibo corresponde a uma operação do cenário simulado do hackathon.</p>}<dl className="space-y-3 break-all"><dt>Evento</dt><dd>{id}</dd><dt>Hash SHA-256 do envelope</dt><dd>{result?.eventHash??'—'}</dd><dt>Emissor signatário</dt><dd>{result?.issuer??'—'}</dd><dt>Transação</dt><dd>{result?.signature??'—'}</dd></dl>{result?.explorer&&<a className="text-secondary underline" href={result.explorer} target="_blank" rel="noreferrer">Consultar no Solana Explorer</a>}<p className="text-body-sm text-on-surface-variant">A conferência compara o hash do evento, o programa Memo e a assinatura do emissor. O recibo confirma integridade do registro e não comprova execução física, identidade de sensor ou resultado de IA.</p></main>;
}
