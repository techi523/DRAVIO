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
        background: "#010204",
        foreground: "#f8fafc",
        brand: {
          primary: "#00f2ff",
          secondary: "#ff00ff",
          accent: "#7000ff",
        },
        panel: {
          bg: "rgba(13, 17, 23, 0.7)",
          border: "rgba(255, 255, 255, 0.1)",
          hover: "rgba(0, 242, 255, 0.05)",
        },
        status: {
          online: "#00ffaa",
          warning: "#f59e0b",
          critical: "#ef4444",
          offline: "#64748b",
        }
      },
      backgroundImage: {
        'hud-grid': "radial-gradient(circle, rgba(0, 242, 255, 0.05) 1px, transparent 1px)",
      },
      boxShadow: {
        'glow-primary': '0 0 15px rgba(0, 242, 255, 0.3)',
        'glow-secondary': '0 0 15px rgba(255, 0, 255, 0.3)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
};
export default config;
