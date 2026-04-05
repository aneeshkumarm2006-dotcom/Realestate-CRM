/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Bricolage Grotesque', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          light: '#EFF6FF',
          text: '#1E40AF',
        },
        base: '#F5F4F0',
        surface: '#FFFFFF',
        subtle: '#EEECEA',
      },
      boxShadow: {
        card: '0 1px 4px rgba(26,26,26,0.07), 0 0 0 1px #E2E0DB',
      },
      borderRadius: {
        xl2: '20px',
      },
    },
  },
  plugins: [],
};
