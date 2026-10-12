'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    }).catch(() => null);
    if (res?.ok) {
      router.replace('/comando');
      router.refresh();
      return;
    }
    const data = await res?.json().catch(() => null);
    setError(data?.error ?? 'Não foi possível entrar');
    setBusy(false);
  }

  const field =
    'w-full rounded-t-sm border-b-2 border-outline-variant/50 bg-surface-lowest px-4 py-3 text-body-lg text-on-surface outline-none transition-colors focus:border-primary';
  const label = 'mb-2 block font-display text-label-md uppercase text-on-surface-variant';

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label htmlFor="email" className={label}>E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required className={field} />
      </div>
      <div>
        <label htmlFor="password" className={label}>Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={field} />
      </div>
      {error && (
        <p role="alert" className="rounded-sm bg-error-tint px-4 py-3 text-body-md text-error">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-gradient-to-br from-primary to-primary-container px-6 py-4 font-display text-label-lg uppercase text-on-primary transition hover:shadow-glow-primary-hover disabled:opacity-60"
      >
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
