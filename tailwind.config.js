/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        mb: {
          black: '#0A0A0A',
          dark: '#111111',
          card: '#1A1A1A',
          border: '#2A2A2A',
          green: '#6CC04A',
          'green-dark': '#4A9432',
          'green-light': '#8FD96E',
          white: '#F5F5F5',
          gray: '#888888',
          'gray-light': '#BBBBBB',
        }
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      }
    },
  },
  plugins: [],
};
