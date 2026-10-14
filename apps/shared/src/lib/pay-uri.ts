import { getAddress, isAddress, type Address } from "viem"

export interface PaymentRequest {
  token: Address
  to: Address
  amount: bigint
  chainId: number
}

/** EIP-681: ethereum:<moeda>@<chain>/transfer?address=<destino>&uint256=<valor> */
export function encodePaymentRequest({ token, to, amount, chainId }: PaymentRequest): string {
  return `ethereum:${token}@${chainId}/transfer?address=${to}&uint256=${amount}`
}

const PATTERN = /^ethereum:(0x[0-9a-fA-F]{40})@(\d+)\/transfer\?(.+)$/

/** Aceita o URI direto ou um link com #pay=<URI codificado>. */
export function decodePaymentRequest(text: string): PaymentRequest | null {
  const wrapped = /#pay=([^&]+)/.exec(text)
  let raw = text
  if (wrapped) {
    try {
      raw = decodeURIComponent(wrapped[1])
    } catch {
      return null
    }
  }
  const match = PATTERN.exec(raw.trim())
  if (!match) return null
  const params = new URLSearchParams(match[3])
  const to = params.get("address")
  const amount = params.get("uint256")
  if (!to || !isAddress(to) || !amount || !/^\d+$/.test(amount)) return null
  return { token: getAddress(match[1]), chainId: Number(match[2]), to: getAddress(to), amount: BigInt(amount) }
}

/** Lê um endereço solto, ou o endereço de um URI ethereum:0x…. */
export function decodeAddress(text: string): Address | null {
  const raw = text.trim().replace(/^ethereum:/, "").split(/[@?/]/)[0]
  return isAddress(raw) ? getAddress(raw) : null
}
