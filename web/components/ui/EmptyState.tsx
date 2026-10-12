export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-surface-lowest p-8 text-center">
      <div className="font-display text-title-md text-on-surface">{title}</div>
      {children && <p className="mx-auto mt-2 max-w-md text-body-sm text-on-surface-variant">{children}</p>}
    </div>
  );
}
