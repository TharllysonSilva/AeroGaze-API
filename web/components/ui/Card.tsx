export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-md bg-surface-low p-8 ${className}`}>
      {(title || action) && (
        <header className="mb-6 flex items-center justify-between gap-4">
          {title && <h2 className="font-display text-title-lg text-on-surface">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
