import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      keyframes: {
        "toast-in": { from: { opacity: "0", transform: "translateY(12px) scale(.98)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        speak: { "0%,100%": { boxShadow: "0 0 0 0 rgba(52,211,153,0)" }, "50%": { boxShadow: "0 0 0 3px rgba(52,211,153,.55)" } },
      },
      animation: {
        "toast-in": "toast-in .25s ease-out",
        "fade-in": "fade-in .3s ease-out",
        speak: "speak 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
