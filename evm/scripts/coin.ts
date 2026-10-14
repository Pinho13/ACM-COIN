import { parseUnits } from "viem"

/** A ACM-COIN, como está em ACM-COIN.md. */
export const ACM_COIN = {
  name: "ACM-COIN",
  symbol: "ACM-COIN",
  initialSupply: parseUnits("1000000", 18),
  maxSupply: parseUnits("2000000", 18),
  inflationBps: 6_700n,
  feeBps: 100n,
} as const

export const coinArgs = [
  ACM_COIN.name,
  ACM_COIN.symbol,
  ACM_COIN.initialSupply,
  ACM_COIN.maxSupply,
  ACM_COIN.inflationBps,
  ACM_COIN.feeBps,
] as const
