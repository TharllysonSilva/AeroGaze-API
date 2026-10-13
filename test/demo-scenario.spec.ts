import { applyCommand, initialScenario, scenarioTelemetry } from '../src/demo/scenario';

test('falha impede irrigar; reparo permite ligar e conserva histórico',()=>{
  const s=initialScenario();
  applyCommand(s,'irrigation.fail');
  expect(()=>applyCommand(s,'irrigation.start')).toThrow();
  applyCommand(s,'irrigation.repair');applyCommand(s,'irrigation.start');
  expect(s.irrigation.status).toBe('irrigando');expect(s.irrigation.flow).toBeGreaterThan(0);
  expect(s.history.map(h=>h.command)).toEqual(['irrigation.start','irrigation.repair','irrigation.fail']);
});
test('vacinação consome uma dose e repetição não altera estoque',()=>{
  const s=initialScenario();applyCommand(s,'animal.vaccinate','BR-001');
  expect(s.stock.vaccines).toBe(23);expect(()=>applyCommand(s,'animal.vaccinate','BR-001')).toThrow();
  expect(s.stock.vaccines).toBe(23);expect(()=>applyCommand(s,'animal.treat','OUTRO')).toThrow();
});
test('telemetria fictícia sem talhão não inventa coordenadas; dados iguais no mesmo instante',()=>{
  const s=initialScenario();const t=scenarioTelemetry(s,[],1000000);
  expect(t.simulated).toBe(true);expect(t.points[0].lat).toBeUndefined();
  expect(t).toEqual(scenarioTelemetry(s,[],1000000));expect(t.series).toHaveLength(12);
});

test('métricas ilustrativas compartilham identidade e acompanham o atendimento',()=>{
  const s=initialScenario();const before=scenarioTelemetry(s,[],1000000);
  expect(before.crop.simulated).toBe(true);expect(before.animalStats).toHaveLength(s.animals.length);
  expect(before.animalStats[2]).toMatchObject({id:'BR-003',simulated:true,thermalStress:'Moderado'});
  applyCommand(s,'animal.treat','BR-003');
  expect(scenarioTelemetry(s,[],1000000).animalStats[2].thermalStress).toBe('Baixo');
});
