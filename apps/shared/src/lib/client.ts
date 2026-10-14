import { createPublicClient, createWalletClient, http, type Account } from "viem"
import { polkadotDevnet } from "../chain"

export const chain = polkadotDevnet

export const publicClient = createPublicClient({ chain, transport: http(), pollingInterval: 2_000 })

export function walletClient(account: Account) {
  return createWalletClient({ account, chain, transport: http() })
}

export function explorerTx(hash: string) {
  return `${chain.blockExplorers.default.url}/tx/${hash}`
}

export function explorerAddress(address: string) {
  return `${chain.blockExplorers.default.url}/address/${address}`
}
