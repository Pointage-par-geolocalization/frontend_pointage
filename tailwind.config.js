/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef4ff", 100: "#d9e6ff", 200: "#b8d0ff", 300: "#8bb1ff",
          400: "#5c8bff", 500: "#3366ff", 600: "#2249e6", 700: "#1c3bb8",
          800: "#1a3390", 900: "#182c72"
        }
      }
    },
  },
  plugins: [],
}
