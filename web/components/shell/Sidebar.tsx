'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import type { NavItem } from '@/lib/nav';

export function Sidebar({ items, userName, roleLabel }: { items: Omit<NavItem, 'roles' | 'scenario'>[]; userName: string; roleLabel: string }) {
  const pathname = usePathname();
  return (
    <aside className="app-sidebar bg-surface">
      <div className="flex items-center gap-4 px-6 pb-8 pt-6">
        <Logo size={44} />
        <div>
          <div className="font-display text-title-lg text-primary">AeroGaze AI</div>
          <div className="font-display text-label-sm uppercase text-on-surface-variant">Terminal operacional</div>
        </div>
      </div>

      <nav aria-label="Principal" className="flex-1">
        {items.filter(item=>!['/galeria','/termica','/timeline'].includes(item.href)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/') || (item.href==='/telemetria'&&['/galeria','/termica','/timeline'].includes(pathname));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-4 border-l-[3px] px-6 py-4 font-display text-label-lg uppercase transition-colors ${
                active
                  ? 'border-primary bg-primary-tint-1 text-primary'
                  : 'border-transparent text-on-surface-variant hover:bg-surface-low hover:text-on-surface'
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 pb-6"><Link href="/comando#tarefas" className="mb-5 block rounded-md bg-primary-container p-4 text-center font-display text-label-md uppercase text-on-primary">Tarefas e missões</Link><Link href="/download" className="mb-5 block text-center text-body-sm text-secondary">Baixar app Android ↗</Link>
        <div className="rounded-md bg-surface-low p-4">
          <div className="font-display text-title-md text-on-surface">{userName}</div>
          <div className="font-display text-label-sm uppercase text-on-surface-variant">{roleLabel}</div>
          <form action="/api/auth/logout" method="post" className="mt-3">
            <button className="font-display text-label-md uppercase text-secondary hover:text-secondary-container" type="submit">
              Sair
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
