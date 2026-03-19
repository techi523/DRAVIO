import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#020308",
        foreground: "#ffffff",
        danger: "#ff0055",
        success: "#00ffaa",
        warning: "#ffaa00",
        command: {
          low: "#0a0c10",
          mid: "#151921",
          high: "#1f2530",
        }
      },
    },
  },
  plugins: [],
};
export default config;
