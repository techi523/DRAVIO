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
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#00f2ff",
        secondary: "#7000ff",
        neon: {
          blue: "#00f2ff",
          purple: "#bc13fe",
          green: "#00ff41",
        },
        surface: {
          low: "#0a0b1e",
          mid: "#14162e",
          high: "#1d1f3d",
        }
      },
      backgroundImage: {
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "mesh-dark": "radial-gradient(at 0% 0%, #0a0b1e 0, transparent 50%), radial-gradient(at 50% 0%, #14162e 0, transparent 50%), radial-gradient(at 100% 0%, #0a0b1e 0, transparent 50%)",
      },
      backdropBlur: {
        xs: "2px",
      }
    },
  },
  plugins: [],
};
export default config;
