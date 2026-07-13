/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F4F0",
        ink: "#141414",
        muted: "#6E6E73",
        accent: "#E85D04",
        surface: "#FFFFFF",
        card: "#FFFFFF",
        "surface-muted": "#EBEAE6",
        line: "#E2E0DA",
        success: "#2D8A4E",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 16px rgba(0,0,0,0.06)",
        soft: "0 2px 16px rgba(0,0,0,0.06)",
      },
      borderRadius: {
        panel: "1rem",
        button: "0.75rem",
      },
    },
  },
  plugins: [],
};
