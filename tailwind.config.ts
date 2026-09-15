import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta oscura tipo "gemelo digital / centro de mando"
        base: {
          900: "#070b14",
          800: "#0b1120",
          700: "#111a2e",
          600: "#1a2540",
          500: "#243252",
        },
        accent: {
          DEFAULT: "#22d3ee",
          soft: "#0e7490",
          glow: "#67e8f9",
        },
        signal: {
          good: "#4ade80",
          warn: "#facc15",
          bad: "#f87171",
          alert: "#fb7185",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(34, 211, 238, 0.25)",
        panel: "0 8px 30px rgba(0, 0, 0, 0.5)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        pulseSoft: "pulseSoft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
