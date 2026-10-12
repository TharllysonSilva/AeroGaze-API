'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-10">
      <div className="rounded-md bg-error-tint p-8">
        <h2 className="font-display text-title-lg text-error">Não foi possível carregar os dados</h2>
        <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">
          A API pode estar fora do ar ou reiniciando. Seus dados de campo continuam salvos no aparelho e sincronizam depois.
        </p>
        <button onClick={reset} className="mt-6 rounded-md bg-surface-high px-6 py-3 font-display text-label-lg uppercase text-on-surface hover:bg-surface-highest">
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
