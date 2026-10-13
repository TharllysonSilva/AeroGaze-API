/** Monograma A: A com folha na barra e antena de sinal (a logo escolhida). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="AeroGaze">
      <rect width="512" height="512" rx="112" fill="#0F1512" />
      <path d="M136 420 L256 175 L376 420" fill="none" stroke="#9BF59A" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M196 362 C220 305 290 295 330 322 C312 372 246 392 196 362 Z" fill="#9BF59A" stroke="#0F1512" strokeWidth="7" strokeLinejoin="round" />
      <path d="M196 362 L330 322" stroke="#0F1512" strokeWidth="5" strokeLinecap="round" />
      <circle cx="256" cy="140" r="11" fill="#7FE3F5" />
      <g fill="none" stroke="#7FE3F5" strokeWidth="10" strokeLinecap="round">
        <path d="M229.1 113.1 A38 38 0 0 1 282.9 113.1" />
        <path d="M205.1 89.1 A72 72 0 0 1 306.9 89.1" opacity="0.65" />
      </g>
    </svg>
  );
}
