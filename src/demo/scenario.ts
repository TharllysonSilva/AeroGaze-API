import { BadRequestException, ConflictException } from '@nestjs/common';

export const COMMANDS = ['irrigation.fail','irrigation.start','irrigation.stop','irrigation.repair',
  'pest.detect','pest.resolve','drone.dispatch','drone.return','animal.treat','animal.vaccinate',
  'animal.move','stock.replenish','support.request'] as const;
export type Command = typeof COMMANDS[number];
export interface Scenario {
  simulated: true; version: number; updatedAt: string;
  irrigation: { status: string; moisture: number; pressure: number; flow: number };
  drone: { status: string; battery: number; signal: number };
  animals: { id: string; name: string; status: string; temperature: number; heartRate: number; battery: number; plot: number; vaccinated: boolean }[];
  pest: boolean; stock: { feedKg: number; vaccines: number }; support: string;
  history: { at: string; command: string; target?: string; label: string; eventId?:string }[];
}
export function initialScenario(now = new Date().toISOString()): Scenario {
  return { simulated:true,version:0,updatedAt:now,irrigation:{status:'parada',moisture:31,pressure:0,flow:0},
    drone:{status:'base',battery:96,signal:92},pest:false,stock:{feedKg:840,vaccines:24},support:'nenhum',
    animals:Array.from({length:12},(_,i)=>({id:`BR-${String(i+1).padStart(3,'0')}`,name:['Aurora','Estrela','Lua','Sol'][i%4],
      status:i===2?'atencao':'saudavel',temperature:i===2?40.1:38.3+(i%4)*0.1,heartRate:i===2?96:62+i*2,
      battery:94-i*3,plot:i%3,vaccinated:false})),history:[] };
}
export function applyCommand(state: Scenario, command: Command, target?: string, now = new Date().toISOString()): string {
  let label = '';
  const irrigation=state.irrigation;
  switch(command) {
    case 'irrigation.fail': irrigation.status='falha';irrigation.pressure=0.2;irrigation.flow=0;irrigation.moisture=22;label='Falha de irrigação detectada • pressão abaixo do limite';break;
    case 'irrigation.repair': if(irrigation.status!=='falha')throw new ConflictException('Não há falha de irrigação para reparar');irrigation.status='parada';irrigation.pressure=0;label='Manutenção de irrigação concluída';break;
    case 'irrigation.start': if(irrigation.status==='falha')throw new ConflictException('Repare a falha antes de ligar');irrigation.status='irrigando';irrigation.pressure=3.2;irrigation.flow=18.5;irrigation.moisture=46;label='Irrigação iniciada • vazão 18,5 m³/h';break;
    case 'irrigation.stop': irrigation.status='parada';irrigation.pressure=0;irrigation.flow=0;label='Irrigação interrompida pelo operador';break;
    case 'pest.detect':state.pest=true;label='Ocorrência simulada de pragas • inspeção solicitada';break;
    case 'pest.resolve':if(!state.pest)throw new ConflictException('Não há ocorrência de pragas aberta');state.pest=false;label='Inspeção de pragas concluída e ocorrência resolvida';break;
    case 'drone.dispatch':if(state.drone.status==='missao')throw new ConflictException('Drone já está em missão');state.drone.status='missao';state.drone.battery=Math.max(20,state.drone.battery-8);label='Drone AERO-01 enviado para vistoria';break;
    case 'drone.return':state.drone.status='base';state.drone.battery=96;label='Drone retornou à base e recarregou';break;
    case 'animal.treat':case 'animal.vaccinate':case 'animal.move': {
      const animal=state.animals.find(a=>a.id===target);if(!animal)throw new BadRequestException('Animal não encontrado no cenário');
      if(command==='animal.treat'){animal.status='saudavel';animal.temperature=38.5;animal.heartRate=68;label=`Atendimento veterinário de ${animal.id} concluído`;}
      if(command==='animal.vaccinate'){if(animal.vaccinated)throw new ConflictException('Animal já vacinado neste cenário');if(state.stock.vaccines<1)throw new ConflictException('Estoque de vacinas esgotado');state.stock.vaccines--;animal.vaccinated=true;label=`Vacinação de ${animal.id} registrada`;}
      if(command==='animal.move'){animal.plot=(animal.plot+1)%3;label=`${animal.id} transferido ao piquete ${animal.plot+1}`;}
      break;
    }
    case 'stock.replenish':state.stock.feedKg+=200;state.stock.vaccines+=12;label='Pedido recebido: 200 kg de ração e 12 doses';break;
    case 'support.request':state.support='em_atendimento';label='Chamado de apoio enviado ao Centro de Comando';break;
  }
  state.version++;state.updatedAt=now;state.history.unshift({at:now,command,target,label});state.history=state.history.slice(0,50);
  return label;
}

export function scenarioTelemetry(state: Scenario, plots: any[], now = Date.now()) {
  const rings=plots.map(p=>p.boundary?.coordinates?.[0]).filter(Boolean);
  const centers=rings.map(r=>({lon:r.reduce((s:number,c:number[])=>s+c[0],0)/r.length,lat:r.reduce((s:number,c:number[])=>s+c[1],0)/r.length}));
  // Pontos fictícios calculados no interior aproximado da área cadastrada, nunca GPS do aparelho.
  const position=(i:number,phase=i,moving=true)=>{
    const ring=rings[i%Math.max(1,rings.length)];const center=centers[i%Math.max(1,centers.length)];
    if(!ring||!center)return null;
    const spanLon=Math.max(...ring.map((c:number[])=>c[0]))-Math.min(...ring.map((c:number[])=>c[0]));
    const spanLat=Math.max(...ring.map((c:number[])=>c[1]))-Math.min(...ring.map((c:number[])=>c[1]));
    const time=moving?now/30000:0;
    return {lon:center.lon+Math.sin(time+phase)*spanLon*.12,lat:center.lat+Math.cos(time+phase)*spanLat*.12};
  };
  return {sampledAt:new Date(now).toISOString(),simulated:true,
    points:[...state.animals.map((a,i)=>({id:a.id,kind:'animal',label:a.id,status:a.status,...position(a.plot,i)})),
      {id:'AERO-01',kind:'drone',label:'AERO-01',status:state.drone.status,...position(0,0,state.drone.status==='missao')},
      {id:'IRR-01',kind:'irrigacao',label:'IRR-01',status:state.irrigation.status,...position(1,1,false)}],
    series:Array.from({length:12},(_,i)=>({at:new Date(now-(11-i)*300000).toISOString(),
      moisture:Math.round(state.irrigation.moisture+Math.sin(i)*2),temperature:Math.round((26+Math.sin(i/2)*2)*10)/10,
      pressure:state.irrigation.pressure,flow:state.irrigation.flow}))};
}
