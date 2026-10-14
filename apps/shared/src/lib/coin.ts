import { formatUnits, getAddress, isAddress, parseUnits, type Address } from "viem"
import { moedaAbi } from "../generated/moeda"
import { publicClient } from "./client"

const configured = import.meta.env.COIN_ADDRESS ?? ""

/** A moeda do Level 1, fixada no build pela variável COIN_ADDRESS. */
export const COIN: Address | null = isAddress(configured) ? getAddress(configured) : null

export interface CoinInfo {
  address: Address
  name: string
  symbol: string
  decimals: number
  feeBps: bigint
  treasury: Address
}

let info: Promise<CoinInfo> | null = null

export function coinInfo(): Promise<CoinInfo> {
  if (!COIN) return Promise.reject(new Error("Esta app foi construída sem COIN_ADDRESS."))
  if (!info) {
    const address = COIN
    const read = <T>(functionName: string) =>
      publicClient.readContract({ address, abi: moedaAbi, functionName: functionName as never }) as Promise<T>
    info = Promise.all([read<string>("name"), read<string>("symbol"), read<number>("decimals"), read<bigint>("feeBps"), read<Address>("treasury")]).then(
      ([name, symbol, decimals, feeBps, treasury]) => ({ address, name, symbol, decimals: Number(decimals), feeBps, treasury }),
    )
    info.catch(() => (info = null))
  }
  return info
}

export function coinBalance(owner: Address) {
  if (!COIN) return Promise.reject(new Error("Sem moeda"))
  return publicClient.readContract({ address: COIN, abi: moedaAbi, functionName: "balanceOf", args: [owner] })
}

/** A taxa que a moeda cobra a mais a quem envia. O tesouro não paga. */
export function feeFor(coin: CoinInfo, amount: bigint, payer: Address) {
  if (coin.treasury.toLowerCase() === payer.toLowerCase()) return 0n
  return (amount * coin.feeBps + 9_999n) / 10_000n
}

export function formatAmount(value: bigint, decimals = 18, maxFraction = 2) {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".")
  let shown = fraction.slice(0, maxFraction).replace(/0+$/, "")
  if (shown && shown.length < 2) shown = shown.padEnd(2, "0")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return shown ? `${grouped},${shown}` : grouped
}

export function parseAmount(text: string, decimals = 18) {
  const clean = text.replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(\.\d+)?$/.test(clean)) throw new Error("Valor inválido.")
  return parseUnits(clean, decimals)
}
