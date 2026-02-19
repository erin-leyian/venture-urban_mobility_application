/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "taxi-yellow": "#FFD700",
        "taxi-dark": "#E6C200",
        charcoal: "#1C1C1E",
        "card-bg": "#2C2C2E",
        "zinc-950": "#09090b",
      },
    },
  },
  plugins: [],
};
