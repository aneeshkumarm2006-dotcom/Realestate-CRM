/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Monday's product typeface — one family, weight carries hierarchy.
        display: ['Figtree', 'system-ui', 'sans-serif'],
        body: ['Figtree', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: '#0073EA',
          hover: '#0060B9',
          light: '#E5F0FD',
          text: '#0073EA',
        },
        base: '#F6F7FB',
        surface: '#FFFFFF',
        subtle: '#F0F1F5',
      },
      boxShadow: {
        card: '0 1px 3px rgba(29,30,38,0.06), 0 0 0 1px #E6E9EF',
        soft: '0 4px 14px -4px rgba(29,30,38,0.12), 0 0 0 1px rgba(29,30,38,0.05)',
        pop: '0 12px 32px -8px rgba(29,30,38,0.20), 0 0 0 1px rgba(29,30,38,0.07)',
        accent: '0 4px 14px -3px rgba(0,115,234,0.40)',
      },
      borderRadius: {
        xl2: '20px',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(.22,.61,.36,1)',
      },
    },
  },
  plugins: [],
};
