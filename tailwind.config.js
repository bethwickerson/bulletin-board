/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'tooltip-bounce': 'tooltip-bounce-up 1s ease-out forwards',
      },
      keyframes: {
        'tooltip-bounce-up': {
          '0%': { transform: 'translateY(100px)', opacity: '0' },
          '60%': { transform: 'translateY(-10px)', opacity: '1' },
          '80%': { transform: 'translateY(5px)', opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
