
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        surface: '#ffffff',
        'surface-container': '#f0faf4',
        'surface-bright': '#d1ead9',
        primary: {
          DEFAULT: '#16a34a',
          hover: '#15803d',
          active: '#166534',
          container: '#dcfce7',
          'on-container': '#166534',
        },
        'on-primary': '#ffffff',
        secondary: '#0d9488',
        error: '#dc2626',
        danger: '#dc2626',
        success: '#16a34a',
        warning: '#d97706',
        'on-surface': '#0f172a',
        'on-surface-variant': '#64748b',
        outline: '#e2e8f0',
        'outline-variant': '#cbd5e1',
      },
      fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] },
    },
  },
  plugins: [],
};
