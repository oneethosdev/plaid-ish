/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f3faf0',
          100: '#e7f5e1',
          200: '#c9e7b9',
          300: '#abda92',
          400: '#8dcd6a',
          500: '#85BB65', // requested primary
          600: '#6da052',
          700: '#568540',
          800: '#3e6a2d',
          900: '#274f1b',
        },
        bone: {
          50: '#faf9f7',
          100: '#f5f3ef',
          200: '#ece9e2',
          300: '#e2ded5',
          400: '#d8d3c8',
          500: '#cdc8bb',
          600: '#bdb3a0',
          700: '#a99b81',
          800: '#8f836b',
          900: '#756a58',
        },
      },
    },
  },
  plugins: [],
};

