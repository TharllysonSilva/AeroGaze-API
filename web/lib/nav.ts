import type { Role } from './types';

export type IconName = 'grid' | 'pulse' | 'drone' | 'chart' | 'box' | 'shield' | 'gear';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  roles: Role[];
  /** Terminal conectado ao cenário de demonstração compartilhado. */
  scenario?: boolean;
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
    scenario: true,
  },
  {
    href: '/frota',
    label: 'Frota',
    icon: 'drone',
    roles: ['gerente', 'administrador'],
    scenario: true,
  },
  {
    href: '/analise',
    label: 'Análise',
    icon: 'chart',
    roles: ['gerente', 'auditor', 'administrador'],
    scenario: true,
  },
  {
    href: '/logistica',
    label: 'Logística',
    icon: 'box',
    roles: ['gerente', 'administrador'],
    scenario: true,
  },
  { href: '/galeria', label: 'Inspeções', icon: 'grid', roles: ['veterinario','gerente','auditor','administrador'], scenario: true },
  { href: '/termica', label: 'Visão térmica', icon: 'pulse', roles: ['veterinario','gerente','auditor','administrador'], scenario: true },
  { href: '/timeline', label: 'Operações', icon: 'chart', roles: ['veterinario','gerente','auditor','administrador'], scenario: true },
  { href: '/auditoria', label: 'Auditoria', icon: 'shield', roles: ['gerente', 'auditor', 'administrador'] },
  {
    href: '/configuracoes',
    label: 'Configurações',
    icon: 'gear',
    roles: ['administrador'],
    scenario: true,
  },
];

export const navFor = (role: Role) => NAV.filter((n) => n.roles.includes(role));
