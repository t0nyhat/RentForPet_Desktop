/* eslint-disable @typescript-eslint/no-require-imports */
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          light: "#fdece1",
          DEFAULT: "#f58a1e",
          dark: "#c1640f",
        },
      },
      spacing: {
        safe: "env(safe-area-inset)",
        "safe-top": "env(safe-area-inset-top)",
        "safe-right": "env(safe-area-inset-right)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
