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
          black:       '#0A0A0A',
          darker:      '#0D0D0D',
          dark:        '#111111',
          card:        '#1A1A1A',
          border:      '#2A2A2A',
          'border-dim': '#181818',
          'border-faint': '#161616',
          green:       '#6CC04A',
          'green-alt': '#8DC63F',
          'green-dark':'#4A9432',
          'green-light':'#8FD96E',
          white:       '#F5F5F5',
          'text':      '#F0F0F0',
          'text-dim':  '#D0D0D0',
          'text-muted':'#C8C8C8',
          gray:        '#888888',
          'gray-light':'#BBBBBB',
          'gray-dark': '#555555',
          'gray-faint':'#444444',
          'gray-deep': '#333333',
          red:         '#E05252',
          yellow:      '#EAB308',
          blue:        '#4A90D9',
          purple:      '#A78BFA',
        }
      },
      fontFamily: {
        sans: ["'DM Sans'", 'system-ui', 'sans-serif'],
        mono: ["'DM Mono'", 'monospace'],
      }
    },
  },
  plugins: [],
};
