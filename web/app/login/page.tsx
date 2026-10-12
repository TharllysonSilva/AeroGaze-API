import { Logo } from '@/components/Logo';
import { LoginForm } from './login-form';

export const metadata = { title: 'Entrar · AeroGaze' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-5">
          <Logo size={64} />
          <div>
            <div className="font-display text-headline-lg text-primary">AeroGaze AI</div>
            <div className="font-display text-label-md uppercase text-on-surface-variant">O sistema operacional da fazenda inteligente</div>
          </div>
        </div>
        <div className="rounded-md bg-surface-low p-8">
          <h1 className="mb-6 font-display text-title-lg text-on-surface">Entrar no centro de comando</h1>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
