export type Role = 'operador' | 'veterinario' | 'gerente' | 'auditor' | 'administrador';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  farmId: string | null;
}

export interface Farm {
  id: string;
  name: string;
}

export interface Plot {
  id: string;
  name: string;
  kind: 'talhao' | 'piquete';
  boundary: { type: 'Polygon'; coordinates: number[][][] };
}

export interface Alert {
  id: string;
  farm_id: string;
  plot_id: string | null;
  rule: string;
  severity: 'baixa' | 'media' | 'alta' | 'critica';
  title: string;
  details: Record<string, any>;
  status: 'aberto' | 'reconhecido' | 'resolvido';
  created_at: string;
}

export interface Task {
  source_event_id?: string;
  id: string;
  farm_id: string;
  plot_id: string | null;
  alert_id: string | null;
  title: string;
  description: string | null;
  priority: 'baixa' | 'media' | 'alta' | 'critica';
  status: 'pendente' | 'em_progresso' | 'concluida';
  created_at: string;
}

export interface EventRow {
  id: string;
  farm_id: string;
  plot_id: string | null;
  device_id: string;
  type: string;
  occurred_at: string;
  received_at: string;
  payload: Record<string, any>;
}

export interface ProofBatch {
  id: string;
  farm_id: string;
  merkle_root: string;
  leaf_count: number;
  status: 'pendente' | 'ancorado' | 'falhou';
  attempts: number;
  last_error: string | null;
  anchor_mode: 'mock' | 'evm' | null;
  chain_id: string | null;
  tx_ref: string | null;
  block_number: string | null;
  created_at: string;
  anchored_at: string | null;
}

export interface VerifyResult {
  batchId: string;
  valid: boolean;
  status: string;
  merkleRoot: string;
  recomputedRoot: string | null;
  leafCount: number;
  tamperedEventCount: number;
  onChain: { checked: boolean; matches?: boolean; revoked?: boolean };
  anchor: { mode: string | null; chainId: string | null; txRef: string | null; blockNumber: string | null; anchoredAt: string | null };
  note?: string;
}
