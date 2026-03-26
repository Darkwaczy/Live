/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#121212',
        surface: '#1E1E1E',
        surfaceLight: '#2C2C2C',
        emerald: '#00C896',
        gold: '#F4D03F',
        danger: '#ef4444'
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
