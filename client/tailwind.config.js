/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--text-inverse)",
        },
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        border: "var(--border-color)",
        muted: "var(--bg-hover)",
      },
      borderRadius: {
        full: "var(--radius-full)",
      }
    },
  },
  plugins: [],
}
