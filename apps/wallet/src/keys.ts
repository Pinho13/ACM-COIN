import { validateMnemonic } from "@scure/bip39"
import { english, generateMnemonic, mnemonicToAccount } from "viem/accounts"

const KEY = "acm-coin/wallet/mnemonic"

function normalize(phrase: string) {
  return phrase.trim().toLowerCase().split(/\s+/).join(" ")
}

/** Lê a mnemónica do localStorage, ou gera uma nova de 12 palavras na primeira visita. */
export function loadOrCreateMnemonic(): string {
  const stored = localStorage.getItem(KEY)
  if (stored && validateMnemonic(stored, english)) return stored
  const fresh = generateMnemonic(english, 128)
  localStorage.setItem(KEY, fresh)
  return fresh
}

/** Valida 12 palavras e devolve-as normalizadas, sem guardar nada. */
export function checkMnemonic(phrase: string): string {
  const clean = normalize(phrase)
  if (clean.split(" ").length !== 12) throw new Error("São precisas exatamente 12 palavras.")
  if (!validateMnemonic(clean, english)) throw new Error("Estas palavras não formam uma carteira válida.")
  return clean
}

export function saveMnemonic(phrase: string) {
  localStorage.setItem(KEY, checkMnemonic(phrase))
}

export function accountFrom(mnemonic: string) {
  return mnemonicToAccount(mnemonic)
}
