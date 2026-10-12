import type { Role } from './types';

export type IconName = 'grid' | 'pulse' | 'drone' | 'chart' | 'box' | 'shield' | 'gear';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  roles: Role[];
  /** Texto da tela "em construção" (o que falta para esta seção existir de verdade). */
  pending?: string;
}

const ALL: Role[] = ['operador', 'veterinario', 'gerente', 'auditor', 'administrador'];

/** Quem vê o quê: mesma matriz do DESIGN-SYSTEM.md (seção 7). A API continua sendo quem garante a permissão. */
export const NAV: NavItem[] = [
  { href: '/comando', label: 'Comando', icon: 'grid', roles: ALL },
  {
    href: '/telemetria',
    label: 'Telemetria',
    icon: 'pulse',
    roles: ['veterinario', 'gerente', 'auditor', 'administrador'],
    pending: 'Falta a ingestão de telemetria de sensores, coleiras e drones na API (hoje ela recebe inspeções e posições). Quando existir, esta tela mostra a galeria de inspeção e a visão térmica.',
  },
  {
    href: '/frota',
    label: 'Frota',
    icon: 'drone',
    roles: ['gerente', 'administrador'],
    pending: 'Falta o cadastro de dispositivos com status, bateria e sinal. A tabela de dispositivos já existe no banco (devices), mas sem telemetria.',
  },
  {
    href: '/analise',
    label: 'Análise',
    icon: 'chart',
    roles: ['gerente', 'auditor', 'administrador'],
    pending: 'Depende de NDVI de satélite e de séries históricas, que ainda não entram na API.',
  },
  {
    href: '/logistica',
    label: 'Logística',
    icon: 'box',
    roles: ['gerente', 'administrador'],
    pending: 'Falta o módulo de estoque e pedidos (Regra C) na API.',
  },
  { href: '/auditoria', label: 'Auditoria', icon: 'shield', roles: ['gerente', 'auditor', 'administrador'] },
  {
    href: '/configuracoes',
    label: 'Configurações',
    icon: 'gear',
    roles: ['administrador'],
    pending: 'Falta a gestão de usuários, aparelhos e chaves na API (hoje só existe o login).',
  },
];

export const navFor = (role: Role) => NAV.filter((n) => n.roles.includes(role));
