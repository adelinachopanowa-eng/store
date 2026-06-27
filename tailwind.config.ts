import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Прогрестрейд — тъмнозелено + жълт акцент + кремаво
        brand: {
          50: "#eaf2ec",
          100: "#d3e3d8",
          200: "#a9c7b3",
          500: "#21603b",
          600: "#1a4a2e",
          700: "#143a24",
          800: "#0f2c1b",
        },
        accent: {
          400: "#f0c040",
          500: "#e0b030",
          600: "#c89a20",
        },
        cream: "#f5f4ee",
      },
      fontFamily: {
        sans: ['"Segoe UI"', "system-ui", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
