/** @type {import('tailwindcss').Config} */
const typography = require('@tailwindcss/typography');

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Heights are tokens: avoid arbitrary `h-[...]` / `max-h-[...]` in components.
      maxHeight: {
        // Standard modal viewport clamp.
        modal: 'calc(100vh - 2rem)',
        // Used for mail log bodies and other "large pre" scroll areas.
        'scroll-lg': '28rem',
        // Registry / metadata side panels where 420px gives a good balance.
        'scroll-registry': '420px',
      },
      height: {
        console: 'var(--console-h)',
        'console-focus': 'var(--console-focus-h)',
      },
      width: {
        'drawer-sm': 'var(--drawer-w-sm)',
        'drawer-md': 'var(--drawer-w-md)',
        'drawer-lg': 'var(--drawer-w-lg)',
        'drawer-xl': 'var(--drawer-w-xl)',
      },
      minWidth: {
        'table-sm': 'var(--table-min-w-sm)',
        'table-md': 'var(--table-min-w-md)',
        'table-lg': 'var(--table-min-w-lg)',
        'table-xl': '80rem',
      },
      // Radii are tokens (defined in src/styles/index.css)
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },

      // Font stacks can be changed without touching every component
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      // Shadows are tokens (defined in src/styles/index.css)
      boxShadow: {
        card: 'var(--shadow-card)',
        panel: 'var(--shadow-panel)',
      },

      colors: {
        // Surfaces
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface-2) / <alpha-value>)',
        'overlay-surface': 'rgb(var(--c-overlay-surface) / <alpha-value>)',
        backdrop: 'rgb(var(--c-backdrop) / <alpha-value>)',
        code: 'rgb(var(--c-code) / <alpha-value>)',

        // Tailwind background-opacity variables can affect descendants if a child uses
        // bg-* without overriding the opacity variable. If you need "glass" surfaces,
        // use these fixed-alpha colors instead of bg-surface/95 etc.
        'surface-glass-95': 'rgb(var(--c-surface) / 0.95)',
        'surface-glass-80': 'rgb(var(--c-surface) / 0.8)',

        // Borders
        border: 'rgb(var(--c-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--c-border-strong) / <alpha-value>)',

        // Text
        fg: 'rgb(var(--c-fg) / <alpha-value>)',
        muted: 'rgb(var(--c-fg-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-fg-faint) / <alpha-value>)',
        disabled: 'rgb(var(--c-fg-disabled) / <alpha-value>)',

        // Links + brand accent
        link: 'rgb(var(--c-link) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--c-accent-hover) / <alpha-value>)',
        'accent-fg': 'rgb(var(--c-accent-fg) / <alpha-value>)',

        // Semantics
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
        'ok-bg': 'rgb(var(--c-ok-bg) / <alpha-value>)',
        'ok-border': 'rgb(var(--c-ok-border) / <alpha-value>)',
        'ok-row': 'rgb(var(--c-ok-row) / <alpha-value>)',

        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        'warn-bg': 'rgb(var(--c-warn-bg) / <alpha-value>)',
        'warn-border': 'rgb(var(--c-warn-border) / <alpha-value>)',
        'warn-row': 'rgb(var(--c-warn-row) / <alpha-value>)',

        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        'danger-bg': 'rgb(var(--c-danger-bg) / <alpha-value>)',
        'danger-border': 'rgb(var(--c-danger-border) / <alpha-value>)',
        'danger-row': 'rgb(var(--c-danger-row) / <alpha-value>)',

        info: 'rgb(var(--c-info) / <alpha-value>)',
        'info-bg': 'rgb(var(--c-info-bg) / <alpha-value>)',
        'info-border': 'rgb(var(--c-info-border) / <alpha-value>)',
        'info-row': 'rgb(var(--c-info-row) / <alpha-value>)',

        neutral: 'rgb(var(--c-neutral) / <alpha-value>)',
        'neutral-bg': 'rgb(var(--c-neutral-bg) / <alpha-value>)',
        'neutral-border': 'rgb(var(--c-neutral-border) / <alpha-value>)',
        'neutral-row': 'rgb(var(--c-neutral-row) / <alpha-value>)',

        // Backwards compat / misc
        overlay: 'rgb(var(--c-overlay) / <alpha-value>)',
        focus: 'rgb(var(--c-focus) / <alpha-value>)',

        // Charts
        'chart-orange': 'rgb(var(--c-chart-orange) / <alpha-value>)',
        'chart-blue': 'rgb(var(--c-chart-blue) / <alpha-value>)',
        'chart-green': 'rgb(var(--c-chart-green) / <alpha-value>)',
        'chart-purple': 'rgb(var(--c-chart-purple) / <alpha-value>)',
        'chart-teal': 'rgb(var(--c-chart-teal) / <alpha-value>)',
        'chart-pink': 'rgb(var(--c-chart-pink) / <alpha-value>)',
        'chart-amber': 'rgb(var(--c-chart-amber) / <alpha-value>)',
        'chart-red': 'rgb(var(--c-chart-red) / <alpha-value>)',

        'chart-grid': 'rgb(var(--c-chart-grid) / <alpha-value>)',
        'chart-axis': 'rgb(var(--c-chart-axis) / <alpha-value>)',
        'chart-axis-strong': 'rgb(var(--c-chart-axis-strong) / <alpha-value>)',
        'chart-crosshair': 'rgb(var(--c-chart-crosshair) / <alpha-value>)',
        'chart-selection': 'rgb(var(--c-chart-selection) / <alpha-value>)',
      },
    },
  },
  plugins: [typography],
};
