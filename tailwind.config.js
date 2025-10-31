/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#10B981',
          dark: '#059669',
        },
        dark: {
          bg: '#0F1116',
          card: '#1A1D24',
          border: '#2D3139',
        }
      }
    },
  },
  plugins: [],
}
