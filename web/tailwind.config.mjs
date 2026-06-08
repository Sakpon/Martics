/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // carest convention — Thai-friendly sans.
        sans: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
