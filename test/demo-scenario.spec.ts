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
