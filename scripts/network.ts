import { defineChain } from "viem"

export const polkadotHubTestnet = defineChain({
  id: 420420417,
  name: "Polkadot Hub TestNet",
  nativeCurrency: { name: "Paseo", symbol: "PAS", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? "https://eth-rpc-testnet.polkadot.io/"] } },
})

export const explorer = "https://blockscout-testnet.polkadot.io"
