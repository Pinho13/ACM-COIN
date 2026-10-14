import { defineChain } from "viem"

export const polkadotDevnet = defineChain({
  id: 420420417,
  name: "Polkadot Hub TestNet",
  nativeCurrency: { name: "Paseo", symbol: "PAS", decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_RPC_URL || "https://eth-rpc-testnet.polkadot.io/"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://blockscout-testnet.polkadot.io" } },
  testnet: true,
})
