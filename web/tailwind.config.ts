import type { Config } from 'tailwindcss';

/**
 * AeroGaze Web — tema Tailwind v3 (Next.js).
 * As cores leem as variáveis de tokens.css (importe esse arquivo no layout global),
 * então uma mudança de token vale para CSS puro e para classes do Tailwind ao mesmo tempo.
 * Uso: bg-surface-low text-on-surface border-outline-variant/15 text-primary rounded-md
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    // Substitui (não estende) as paletas padrão: ninguém usa branco puro nem cor fora do sistema por engano.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
        'surface-lowest': 'rgb(var(--c-surface-lowest) / <alpha-value>)',
        'surface': 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-low': 'rgb(var(--c-surface-low) / <alpha-value>)',
        'surface-container': 'rgb(var(--c-surface-container) / <alpha-value>)',
        'surface-high': 'rgb(var(--c-surface-high) / <alpha-value>)',
        'surface-highest': 'rgb(var(--c-surface-highest) / <alpha-value>)',
        'on-surface': 'rgb(var(--c-on-surface) / <alpha-value>)',
        'on-surface-variant': 'rgb(var(--c-on-surface-variant) / <alpha-value>)',
        'on-surface-muted': 'rgb(var(--c-on-surface-muted) / <alpha-value>)',
        'primary': 'rgb(var(--c-primary) / <alpha-value>)',
        'primary-container': 'rgb(var(--c-primary-container) / <alpha-value>)',
        'on-primary': 'rgb(var(--c-on-primary) / <alpha-value>)',
        'primary-tint-1': 'rgb(var(--c-primary-tint-1) / <alpha-value>)',
        'primary-tint-2': 'rgb(var(--c-primary-tint-2) / <alpha-value>)',
        'primary-tint-3': 'rgb(var(--c-primary-tint-3) / <alpha-value>)',
        'secondary-container': 'rgb(var(--c-secondary-container) / <alpha-value>)',
        'secondary': 'rgb(var(--c-secondary) / <alpha-value>)',
        'on-secondary': 'rgb(var(--c-on-secondary) / <alpha-value>)',
        'warning': 'rgb(var(--c-warning) / <alpha-value>)',
        'on-warning': 'rgb(var(--c-on-warning) / <alpha-value>)',
        'error': 'rgb(var(--c-error) / <alpha-value>)',
        'error-container': 'rgb(var(--c-error-container) / <alpha-value>)',
        'on-error-container': 'rgb(var(--c-on-error-container) / <alpha-value>)',
        'error-tint': 'rgb(var(--c-error-tint) / <alpha-value>)',
        'outline-variant': 'rgb(var(--c-outline-variant) / <alpha-value>)',
        'chart-vegetation': 'rgb(var(--c-chart-vegetation) / <alpha-value>)',
        'chart-health': 'rgb(var(--c-chart-health) / <alpha-value>)',
        'heat-1': 'rgb(var(--c-heat-1) / <alpha-value>)',
        'heat-2': 'rgb(var(--c-heat-2) / <alpha-value>)',
        'thermal-cold': 'rgb(var(--c-thermal-cold) / <alpha-value>)',
        'thermal-mid': 'rgb(var(--c-thermal-mid) / <alpha-value>)',
        'thermal-warm': 'rgb(var(--c-thermal-warm) / <alpha-value>)',
        'thermal-hot': 'rgb(var(--c-thermal-hot) / <alpha-value>)'
    },
    spacing: {
        '0': '0',
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem'
    },
    borderRadius: {
        'none': '0',
        'xs': '2px',
        'sm': '4px',
        'md': '12px',
        'dot': '9999px'
    },
    fontFamily: {
      display: ['var(--font-display)'],
      body: ['var(--font-body)'],
      mono: ['var(--font-mono)']
    },
    fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.05', fontWeight: '700', letterSpacing: '-0.02em' }],
        'display-md': ['2.5rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
        'headline-lg': ['2rem', { lineHeight: '1.15', fontWeight: '700', letterSpacing: '-0.01em' }],
        'headline-md': ['1.5rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '0' }],
        'title-lg': ['1.25rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '0' }],
        'title-md': ['1rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '0' }],
        'body-lg': ['1rem', { lineHeight: '1.5', fontWeight: '400', letterSpacing: '0' }],
        'body-md': ['0.875rem', { lineHeight: '1.45', fontWeight: '400', letterSpacing: '0' }],
        'body-sm': ['0.75rem', { lineHeight: '1.4', fontWeight: '400', letterSpacing: '0' }],
        'label-lg': ['0.875rem', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '0.05em' }],
        'label-md': ['0.75rem', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '0.05em' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '0.05em' }]
    },
    extend: {
      boxShadow: {
        'glow-primary': 'var(--glow-primary)',
        'glow-primary-hover': 'var(--glow-primary-hover)',
        'glow-secondary-hover': 'var(--glow-secondary-hover)',
        'glow-error': 'var(--glow-error)'
      },
      backdropBlur: { glass: '16px' },
      width: { sidebar: 'var(--sidebar-w)' },
      height: { topbar: 'var(--topbar-h)' },
      transitionDuration: { fast: '120ms', base: '200ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.2, 0, 0, 1)' }
    }
  },
  plugins: []
};

export default config;
