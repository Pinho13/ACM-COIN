import { defineConfig } from "vite"

export default defineConfig({
  // O gateway .dot serve a app num caminho próprio, por isso tudo é relativo.
  base: "./",
  // COIN_ADDRESS vem do ambiente e fica fixo no build.
  envPrefix: ["VITE_", "COIN_"],
  server: { host: true },
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
})
