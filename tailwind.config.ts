import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f6f4",
          100: "#dfe9e4",
          600: "#0f4c3a",
          700: "#0c3d2e",
          800: "#0a2f24",
          900: "#07231b",
        },
        accent: {
          500: "#c98a2c",
          600: "#b3781f",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
