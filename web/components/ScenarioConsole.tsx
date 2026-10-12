'use client';
import { useEffect, useState } from 'react';
import { readScenario, runScenarioAction, publishSolanaReceipt, verifySolanaReceipt } from '@/app/(app)/scenario-actions';
import { PlotMap } from './PlotMap';
import { Card } from './ui/Card';
import type { Plot } from '@/lib/types';

const button='rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-primary disabled:opacity-40';
export function ScenarioConsole({initial,farmId,section,canAct}:{initial:any;farmId:string;section:string;canAct:boolean}) {
  const [data,setData]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [filter,setFilter]=useState('todos'),[animalId,setAnimalId]=useState('BR-003');
  const [pending,setPending]=useState<{id:string;command:string;target?:string}|null>(null);
  const [receipt,setReceipt]=useState<any>(null);
  async function solana(eventId:string,publish:boolean){setBusy(true);try{setReceipt(await(publish?publishSolanaReceipt(eventId):verifySolanaReceipt(eventId)));}catch{setError('Recibo Solana indisponível. A operação da fazenda foi preservada.');}finally{setBusy(false);}}
  useEffect(()=>{let active=true;const timer=setInterval(()=>{readScenario(farmId).then(v=>{if(active)setData(v)}).catch(()=>{if(active)setError('Sem atualização da API. Exibindo a última leitura.');});},20000);return()=>{active=false;clearInterval(timer)};},[farmId]);
  async function action(command:string,target?:string) {
    if(busy||!canAct)return;
    const attempt=pending?.command===command&&pending.target===target?pending:{id:crypto.randomUUID(),command,target};
    setPending(attempt);setBusy(true);setError('');
    try {const result=await runScenarioAction(farmId,attempt.id,command,target);setPending(null);setMessage(`${result.label} • evento ${result.eventId}`);setData(await readScenario(farmId));}
    catch {setError('Ação não confirmada. Atualize a leitura ou repita o mesmo botão para consultar a tentativa; não há confirmação local.');}
    finally {setBusy(false);}
  }
  const state=data.state;
  const animals=state.animals.filter((a:any)=>filter==='todos'||a.status==='atencao');
  const selected=state.animals.find((a:any)=>a.id===animalId)??state.animals[0];
  const points=data.telemetry.points.filter((p:any)=>typeof p.lat==='number'&&typeof p.lon==='number').map((p:any)=>({lat:p.lat,lon:p.lon,label:`${p.label} • ${p.status} • simulado`,tone:p.status==='atencao'||p.status==='falha'?'error':p.kind==='drone'?'secondary':'primary'}));
  const control=(text:string,command:string,target?:string)=><button className={button} disabled={busy||!canAct} onClick={()=>action(command,target)}>{text}</button>;
  return <div className="space-y-6">
    <div className="rounded-md border border-secondary/30 bg-surface-low p-4 text-secondary">CENÁRIO SIMULADO DO HACKATHON • Dados compartilhados pela API • versão {state.version}<br/><small>Leitura: {new Date(data.telemetry.sampledAt).toLocaleString('pt-BR')} • As ações não controlam equipamentos físicos.</small></div>
    {error&&<p role="alert" className="rounded-md bg-error/10 p-4 text-error">{error}</p>}
    {message&&<p role="status" className="rounded-md bg-primary/10 p-4 text-primary break-all">{message}</p>}
    <button className={button} disabled={busy} onClick={()=>readScenario(farmId).then(setData).catch(()=>setError('API indisponível'))}>Atualizar leitura</button>
    {['comando','telemetria','analise'].includes(section)&&<>
      <div className="grid gap-4 md:grid-cols-4">{[['Umidade do solo',`${state.irrigation.moisture}%`],['Pressão',`${state.irrigation.pressure} bar`],['Vazão',`${state.irrigation.flow} m³/h`],['Rebanho',`${state.animals.length} animais`]].map(([label,value])=><Card key={label} title={label}><strong className="text-3xl text-primary">{value}</strong></Card>)}</div>
      <Card title="Irrigação • IRR-01"><p className="mb-4">Estado: {state.irrigation.status} • sensor fictício do talhão</p><div className="flex flex-wrap gap-3">{control('Simular falha de irrigação','irrigation.fail')}{control('Reparar irrigação','irrigation.repair')}{control('Iniciar irrigação','irrigation.start')}{control('Parar irrigação','irrigation.stop')}</div></Card>
      <Card title="Monitoramento fitossanitário"><p className="mb-4">{state.pest?'Ocorrência em inspeção':'Sem ocorrência aberta'} • Sem inferência de IA real</p><div className="flex flex-wrap gap-3">{control('Gerar ocorrência de pragas','pest.detect')}{control('Concluir inspeção de pragas','pest.resolve')}</div></Card>
      <Card title="Série fictícia • umidade do solo nos últimos 60 min"><svg viewBox="0 0 600 150" className="w-full" role="img" aria-label="Série simulada de umidade"><path d={data.telemetry.series.map((s:any,i:number)=>`${i?'L':'M'}${20+i*50},${130-s.moisture*2}`).join(' ')} fill="none" stroke="#9cf48c" strokeWidth="3"/><text x="20" y="145" fill="#a8b2a5">Leituras simuladas — % de umidade</text></svg></Card>
    </>}
    {['comando','telemetria','frota','analise'].includes(section)&&<Card title="Mapa operacional • talhões e ativos fictícios"><PlotMap plots={data.plots as Plot[]} points={points}/><div className="mt-3 flex flex-wrap gap-3">{data.telemetry.points.map((p:any)=><span key={p.id} className="rounded-md bg-surface-lowest p-2">{p.label}: {p.status}</span>)}</div></Card>}
    {['comando','frota','telemetria'].includes(section)&&<Card title="Drone AERO-01"><p className="mb-4">{state.drone.status} • bateria {state.drone.battery}% • sinal {state.drone.signal}%</p><div className="flex gap-3">{control('Enviar drone para vistoria','drone.dispatch')}{control('Retornar à base','drone.return')}</div></Card>}
    {['comando','telemetria'].includes(section)&&<Card title="Rebanho e atendimento veterinário"><div className="flex flex-wrap gap-3 mb-4"><select aria-label="Filtrar animais" value={filter} onChange={e=>setFilter(e.target.value)} className="bg-surface-lowest p-3"><option value="todos">Todos os animais</option><option value="atencao">Precisam de atenção</option></select><select aria-label="Selecionar animal" value={animalId} onChange={e=>setAnimalId(e.target.value)} className="bg-surface-lowest p-3">{animals.map((a:any)=><option key={a.id} value={a.id}>{a.id} — {a.name}</option>)}</select></div><p className="mb-4">{selected.id} • {selected.status} • {selected.temperature} °C • {selected.heartRate} bpm • coleira {selected.battery}% • piquete {selected.plot+1} • {selected.vaccinated?'vacinado':'vacinação pendente'}</p><div className="flex flex-wrap gap-3">{control('Registrar atendimento','animal.treat',selected.id)}{control('Registrar vacinação','animal.vaccinate',selected.id)}{control('Transferir de piquete','animal.move',selected.id)}</div></Card>}
    {['logistica','comando'].includes(section)&&<Card title="Estoque e abastecimento"><p className="mb-4">Ração: {state.stock.feedKg} kg • Vacinas: {state.stock.vaccines} doses</p>{control('Receber pedido de reposição','stock.replenish')}</Card>}
    <Card title={section==='configuracoes'?'Ambiente de demonstração e apoio':'Centro de apoio'}><p className="mb-4">Chamado: {state.support} • ações atribuídas à conta autenticada</p>{control('Solicitar apoio ao Comando','support.request')}</Card>
    {receipt&&<Card title="Recibo Solana Devnet"><p>{receipt.valid&&receipt.checked?'Confirmado e conferido na rede':receipt.configured===false?'Aguardando configuração Solana no servidor':`Estado: ${receipt.status} • ainda sem confirmação na rede`}</p>{receipt.explorer&&<a className="text-secondary underline" href={receipt.explorer} target="_blank" rel="noreferrer">Abrir transação no Solana Explorer</a>}</Card>}
    <Card title="Histórico de operações simuladas">{state.history.length===0?<p>Nenhuma ação executada neste cenário.</p>:<ul className="space-y-3">{state.history.map((h:any,i:number)=><li key={`${h.at}-${i}`} className="border-b border-primary/10 pb-3"><time>{new Date(h.at).toLocaleString('pt-BR')}</time> • {h.label}{h.eventId&&<div className="mt-3 flex gap-3"><button className={button} disabled={busy||!canAct} onClick={()=>solana(h.eventId,true)}>Publicar recibo Solana</button><button className={button} disabled={busy} onClick={()=>solana(h.eventId,false)}>Conferir recibo Solana</button></div>}</li>)}</ul>}</Card>
  </div>;
}
