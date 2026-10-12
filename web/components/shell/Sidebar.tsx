'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import type { NavItem } from '@/lib/nav';

export function Sidebar({ items, userName, roleLabel }: { items: Omit<NavItem, 'roles' | 'pending'>[]; userName: string; roleLabel: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-sidebar flex-col bg-surface lg:flex">
      <div className="flex items-center gap-4 px-6 pb-8 pt-6">
        <Logo size={44} />
        <div>
          <div className="font-display text-title-lg text-primary">AeroGaze AI</div>
          <div className="font-display text-label-sm uppercase text-on-surface-variant">Centro de comando</div>
        </div>
      </div>

      <nav aria-label="Principal" className="flex-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
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

      <div className="px-6 pb-6">
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
