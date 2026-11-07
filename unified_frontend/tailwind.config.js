/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        jseBg: "#060911",
        jseCard: "#0D1322",
      },
    },
  },
  plugins: [],
};
