/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#e8e8e8',
          100: '#cccccc',
          500: '#555555',
          600: '#333333',
          700: '#252525',
          900: '#0a0a0a',
        },
      },
    },
  },
  plugins: [],
}
