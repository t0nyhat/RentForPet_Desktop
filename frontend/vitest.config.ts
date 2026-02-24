/// <reference types="vitest" />
import { defineConfig } from "vite";
import reactPlugin from "@vitejs/plugin-react";

const testConfigForPetHotel = defineConfig({
  plugins: [reactPlugin()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/bootstrap.ts",
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
  },
});

export default testConfigForPetHotel;
