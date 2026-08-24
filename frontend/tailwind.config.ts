import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Beep Saúde brand palette — see assets/brand/BRAND.md
        brand: {
          teal: "#00AFAA",
          "teal-light": "#04D4CE",
          "teal-dark": "#008E87",
          orange: "#FBA600",
          bg: "#F4F4F4",
          border: "#E5E5E5",
          text: "#4F5E69",
        },
      },
      fontFamily: {
        sans: ["Raleway", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
