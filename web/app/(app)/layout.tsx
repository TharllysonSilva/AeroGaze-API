import { Sidebar } from '@/components/shell/Sidebar';
import { navFor } from '@/lib/nav';
import { requireSession } from '@/lib/session';

const ROLE_LABEL: Record<string, string> = {
  operador: 'Operador',
  veterinario: 'Veterinário',
  gerente: 'Gerente',
  auditor: 'Auditor',
  administrador: 'Administrador',
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const items = navFor(user.role).map(({ href, label, icon }) => ({ href, label, icon }));
  return (
    <div className="min-h-screen">
      <Sidebar items={items} userName={user.name} roleLabel={ROLE_LABEL[user.role] ?? user.role} />
      <main className="lg:pl-sidebar">{children}</main>
    </div>
  );
}
