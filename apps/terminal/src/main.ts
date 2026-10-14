import QRCode from "qrcode"
import { parseAbiItem, type Address, type Hash, type Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { moedaAbi } from "../../shared/src/generated/moeda"
import { chain, explorerAddress, explorerTx, publicClient, walletClient } from "../../shared/src/lib/client"
import { COIN, coinBalance, coinInfo, feeFor, formatAmount, parseAmount, type CoinInfo } from "../../shared/src/lib/coin"
import { $, copy, errorText, short, show, toast } from "../../shared/src/lib/dom"
import { decodeAddress, encodePaymentRequest } from "../../shared/src/lib/pay-uri"
import { isAndroid, rawbtLink, type Receipt } from "./receipt"

const KEY_KEY = "acm-coin/terminal/key"
const NAME_KEY = "acm-coin/terminal/name"
const SALES_KEY = "acm-coin/terminal/sales"
const POLL_MS = 2_000
const OVERLAY_MS = 1_800
/** O RPC do Hub às vezes mostra um bloco antes de os logs estarem prontos, por isso cada leitura olha para a venda toda. */
const LOG_WINDOW = 300n
const MAX_INT_DIGITS = 7

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)")

interface Sale {
  amount: string
  symbol: string
  decimals: number
  from: Address
  hash: Hash
  at: number
}

/* ---------- conta do terminal ---------- */

function loadOrCreateKey(): Hex {
  const stored = localStorage.getItem(KEY_KEY)
  if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) return stored as Hex
  const key = generatePrivateKey()
  localStorage.setItem(KEY_KEY, key)
  return key
}

const account = privateKeyToAccount(loadOrCreateKey())
const wallet = walletClient(account)
const merchant = account.address

let entry = ""
let coin: CoinInfo | null = null
let stopWatching: (() => void) | null = null
let lastSale: Sale | null = null

function shopName() {
  return localStorage.getItem(NAME_KEY) || "ACM FEUP"
}

async function loadCoin() {
  coin ??= await coinInfo()
  $("#symbol").textContent = coin.symbol
  return coin
}

/* ---------- teclado ---------- */

function renderEntry() {
  const [whole, fraction] = entry.split(",")
  const grouped = (whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  $("#amount").textContent = fraction === undefined ? grouped : `${grouped},${fraction}`
  $<HTMLButtonElement>("#charge").disabled = !/[1-9]/.test(entry)
}

function press(key: string) {
  const [whole, fraction] = entry.split(",")
  if (key === "back") entry = entry.slice(0, -1)
  else if (key === ",") {
    if (fraction === undefined) entry = (entry || "0") + ","
  } else if (/^\d$/.test(key)) {
    if (fraction !== undefined) {
      if (fraction.length < 2) entry += key
    } else if (whole === "0" || entry === "") entry = key
    else if (whole.length < MAX_INT_DIGITS) entry += key
  }
  renderEntry()
}

function resetKeypad() {
  entry = ""
  renderEntry()
  show("keypad")
}

$("#keys").addEventListener("click", (event) => {
  const key = (event.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.key
  if (key) press(key)
})

document.addEventListener("keydown", (event) => {
  if ($("[data-screen=keypad]").hidden || event.target instanceof HTMLInputElement) return
  if (/^\d$/.test(event.key)) press(event.key)
  else if (event.key === "," || event.key === ".") press(",")
  else if (event.key === "Backspace") press("back")
  else if (event.key === "Enter" && !$<HTMLButtonElement>("#charge").disabled) void charge()
  else return
  event.preventDefault()
})

/* ---------- cobrar ---------- */

/** Junta no máximo um milionésimo de moeda, para que duas vendas do mesmo valor nunca casem com a mesma transferência. */
function saleTag(decimals: number) {
  const range = 10n ** BigInt(Math.max(0, decimals - 6))
  return BigInt(crypto.getRandomValues(new Uint32Array(2)).reduce((a, b) => a * 4_294_967_296 + b, 0)) % range
}

$("#charge").addEventListener("click", () => void charge())

async function charge() {
  let info: CoinInfo
  try {
    info = await loadCoin()
  } catch (error) {
    return toast(COIN ? `Sem ligação à rede: ${errorText(error)}` : "Terminal construído sem COIN_ADDRESS.")
  }
  const amount = parseAmount(entry.replace(/,$/, ""), info.decimals) + saleTag(info.decimals)
  const uri = encodePaymentRequest({ token: info.address, to: merchant, amount, chainId: chain.id })
  $("#charge-amount").textContent = formatAmount(amount, info.decimals)
  $("#charge-symbol").textContent = info.symbol
  $("#charge-status").textContent = "à espera do pagamento…"
  const canvas = document.createElement("canvas")
  $("#charge-qr").replaceChildren(canvas)
  await QRCode.toCanvas(canvas, uri, { margin: 0, width: 640, errorCorrectionLevel: "M", color: { dark: "#002f6c", light: "#ffffff" } })
  show("charge")
  stopWatching = watchForPayment(info.address, amount, (payment) => {
    stopWatching = null
    const sale: Sale = { ...payment, amount: amount.toString(), symbol: info.symbol, decimals: info.decimals }
    recordSale(sale)
    celebrate(sale)
  })
}

/** Lê os eventos Transfer da moeda a cada 2 segundos até chegar um para o terminal com o valor exato. */
function watchForPayment(token: Address, amount: bigint, onPaid: (payment: Pick<Sale, "from" | "hash" | "at">) => void) {
  let active = true
  let firstBlock: bigint | null = null
  let timer = 0

  const poll = async () => {
    if (!active) return
    try {
      const latest = await publicClient.getBlockNumber({ cacheTime: 0 })
      if (firstBlock === null) firstBlock = latest > 2n ? latest - 2n : 0n
      const fromBlock = latest - firstBlock > LOG_WINDOW ? latest - LOG_WINDOW : firstBlock
      // O RPC da Polkadot recusa null nos topics, por isso o destino filtra-se aqui.
      const logs = await publicClient.getLogs({ address: token, event: transferEvent, fromBlock, toBlock: latest })
      const match = logs.find((log) => log.args.to?.toLowerCase() === merchant.toLowerCase() && log.args.value === amount)
      if (match && active) {
        active = false
        onPaid({ from: match.args.from!, hash: match.transactionHash!, at: Date.now() })
        return
      }
      $("#charge-status").textContent = "à espera do pagamento…"
    } catch (error) {
      $("#charge-status").textContent = `sem rede, a tentar de novo (${errorText(error).slice(0, 50)})`
    }
    if (active) timer = window.setTimeout(poll, POLL_MS)
  }
  void poll()
  return () => {
    active = false
    clearTimeout(timer)
  }
}

$("#charge-cancel").addEventListener("click", () => {
  stopWatching?.()
  stopWatching = null
  show("keypad")
})

/* ---------- pago e recibo ---------- */

function saleTotal(sale: Sale) {
  return `${formatAmount(BigInt(sale.amount), sale.decimals)} ${sale.symbol}`
}

function saleNumber(sale: Sale) {
  return `#${sale.hash.slice(-6).toUpperCase()}`
}

function saleWhen(sale: Sale) {
  const at = new Date(sale.at)
  return `${at.toLocaleDateString("pt-PT")} · ${at.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`
}

function receiptOf(sale: Sale): Receipt {
  return { shop: shopName(), date: saleWhen(sale), total: saleTotal(sale), from: short(sale.from), sale: saleNumber(sale), link: explorerTx(sale.hash) }
}

function celebrate(sale: Sale) {
  $("#overlay-amount").textContent = saleTotal(sale)
  const overlay = $("#paid-overlay")
  overlay.hidden = false
  navigator.vibrate?.([80, 60, 160])
  const ready = showReceipt(sale)
  let done = false
  const finish = async () => {
    if (done) return
    done = true
    await ready
    overlay.hidden = true
  }
  overlay.addEventListener("click", () => void finish(), { once: true })
  setTimeout(() => void finish(), OVERLAY_MS)
}

async function showReceipt(sale: Sale) {
  lastSale = sale
  const receipt = receiptOf(sale)
  $("#receipt-shop").textContent = receipt.shop
  $("#receipt-date").textContent = receipt.date
  $("#receipt-total").textContent = receipt.total
  $("#receipt-from").textContent = receipt.from
  $("#receipt-sale").textContent = receipt.sale
  const canvas = document.createElement("canvas")
  $("#receipt-qr").replaceChildren(canvas)
  await QRCode.toCanvas(canvas, receipt.link, { margin: 0, width: 320, color: { dark: "#0a1a38", light: "#ffffff" } })
  show("paid")
}

$("#print").addEventListener("click", () => {
  if (!lastSale) return
  if (!isAndroid()) return window.print()
  const link = document.createElement("a")
  link.href = rawbtLink(receiptOf(lastSale))
  link.target = "_blank"
  link.rel = "noopener"
  link.click()
})

$("#new-sale").addEventListener("click", resetKeypad)

/* ---------- vendas do dia ---------- */

function sales(): Sale[] {
  try {
    const stored: Partial<Sale>[] = JSON.parse(localStorage.getItem(SALES_KEY) ?? "[]")
    return stored.filter((sale): sale is Sale => Boolean(sale.hash && sale.amount && sale.at))
  } catch {
    return []
  }
}

function recordSale(sale: Sale) {
  localStorage.setItem(SALES_KEY, JSON.stringify([sale, ...sales()].slice(0, 500)))
}

function todaysSales() {
  const today = new Date().toDateString()
  return sales().filter((sale) => new Date(sale.at).toDateString() === today)
}

$("#open-history").addEventListener("click", () => void openHistory())
$("#history-back").addEventListener("click", resetKeypad)

async function openHistory() {
  const list = todaysSales()
  const total = list.reduce((sum, sale) => sum + BigInt(sale.amount), 0n)
  const symbol = list[0]?.symbol ?? coin?.symbol ?? "ACM-COIN"
  $("#history-total").textContent = `${formatAmount(total, list[0]?.decimals ?? 18)} ${symbol}`
  $("#history-count").textContent = String(list.length)
  $("#history-empty").hidden = list.length > 0
  $("#history-list").replaceChildren(
    ...list.map((sale) => {
      const item = document.createElement("li")
      const link = document.createElement("a")
      link.href = explorerTx(sale.hash)
      link.target = "_blank"
      link.rel = "noopener"
      const cell = (className: string, text: string) => Object.assign(document.createElement("span"), { className, textContent: text })
      link.append(
        cell("when", new Date(sale.at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })),
        cell("who", `${saleNumber(sale)} · ${short(sale.from)}`),
        cell("total", saleTotal(sale)),
      )
      item.append(link)
      return item
    }),
  )
  const balanceLink = $<HTMLAnchorElement>("#history-balance")
  balanceLink.href = explorerAddress(merchant)
  balanceLink.textContent = "…"
  show("history")
  try {
    const info = await loadCoin()
    balanceLink.textContent = `${formatAmount(await coinBalance(merchant), info.decimals)} ${info.symbol}`
  } catch {
    balanceLink.textContent = "sem ligação"
  }
}

/* ---------- definições ---------- */

function addressLink(selector: string, address: string) {
  const link = $<HTMLAnchorElement>(selector)
  link.textContent = short(address)
  link.href = explorerAddress(address)
  link.title = address
}

let merchantQrDrawn = false

$("#open-settings").addEventListener("click", () => {
  $<HTMLInputElement>("#settings-name").value = localStorage.getItem(NAME_KEY) ?? ""
  addressLink("#settings-address", merchant)
  if (COIN) addressLink("#settings-coin", COIN)
  else $("#settings-coin").textContent = "sem COIN_ADDRESS"
  if (!merchantQrDrawn) {
    merchantQrDrawn = true
    const canvas = document.createElement("canvas")
    $("#settings-qr").replaceChildren(canvas)
    void QRCode.toCanvas(canvas, merchant, { margin: 0, width: 320, color: { dark: "#002f6c", light: "#ffffff" } })
  }
  show("settings")
})

$("#settings-name").addEventListener("change", (event) => {
  const name = (event.target as HTMLInputElement).value.trim()
  if (name) localStorage.setItem(NAME_KEY, name)
  else localStorage.removeItem(NAME_KEY)
  $("#shop-name").textContent = shopName()
})

$("#settings-back").addEventListener("click", resetKeypad)
$("#settings-copy").addEventListener("click", () => void copy(merchant))

$("#withdraw-to").addEventListener("input", (event) => {
  const to = decodeAddress((event.target as HTMLInputElement).value)
  const button = $<HTMLButtonElement>("#withdraw")
  button.textContent = to ? `enviar tudo para ${short(to)}` : "enviar tudo"
  button.disabled = !to
})

/** O maior valor que cabe no saldo com a taxa paga a mais. */
function sendable(info: CoinInfo, balance: bigint) {
  let amount = (balance * 10_000n) / (10_000n + info.feeBps)
  while (amount > 0n && amount + feeFor(info, amount, merchant) > balance) amount--
  return amount
}

$("#withdraw").addEventListener("click", async () => {
  const to = decodeAddress($<HTMLInputElement>("#withdraw-to").value)
  if (!to) return toast("Endereço inválido")
  const button = $<HTMLButtonElement>("#withdraw")
  button.disabled = true
  try {
    const info = await loadCoin()
    const amount = sendable(info, await coinBalance(merchant))
    if (amount === 0n) return toast("Sem saldo para levantar")
    const hash = await wallet.writeContract({ address: info.address, abi: moedaAbi, functionName: "transfer", args: [to, amount] })
    toast("Enviado, à espera da rede…")
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    toast(receipt.status === "success" ? `${formatAmount(amount, info.decimals)} ${info.symbol} levantados` : "A transferência falhou")
  } catch (error) {
    toast(errorText(error))
  } finally {
    button.disabled = false
  }
})

/* ---------- arranque ---------- */

async function keepScreenOn() {
  try {
    await navigator.wakeLock?.request("screen")
  } catch {
    return
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void keepScreenOn()
})

const shopParam = new URLSearchParams(location.search).get("loja")
if (shopParam) localStorage.setItem(NAME_KEY, shopParam)
$("#shop-name").textContent = shopName()
resetKeypad()
void keepScreenOn()
void loadCoin().catch(() => undefined)
