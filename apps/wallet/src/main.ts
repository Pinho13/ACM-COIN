import QRCode from "qrcode"
import type { Address, Hash } from "viem"
import { moedaAbi } from "../../shared/src/generated/moeda"
import { chain, explorerTx, publicClient, walletClient } from "../../shared/src/lib/client"
import { COIN, coinBalance, coinInfo, feeFor, formatAmount, parseAmount, type CoinInfo } from "../../shared/src/lib/coin"
import { $, copy, errorText, short, show, toast } from "../../shared/src/lib/dom"
import { decodeAddress, decodePaymentRequest, type PaymentRequest } from "../../shared/src/lib/pay-uri"
import { scanImageFile, startScanner, type Scanner } from "../../shared/src/lib/scanner"
import { accountFrom, checkMnemonic, loadOrCreateMnemonic, saveMnemonic } from "./keys"

let mnemonic = loadOrCreateMnemonic()
let account = accountFrom(mnemonic)
let wallet = walletClient(account)
let me: Address = account.address

let scanner: Scanner | null = null
let scanTarget: "pay" | "send" = "pay"
let pending: { request: PaymentRequest; coin: CoinInfo } | null = null
let refreshTimer = 0

const input = (selector: string) => $<HTMLInputElement>(selector)

function useMnemonic(phrase: string) {
  mnemonic = phrase
  account = accountFrom(phrase)
  wallet = walletClient(account)
  me = account.address
  $("#me-short").textContent = short(me)
}

/* ---------- início ---------- */

async function refreshBalances() {
  const error = $("#home-error")
  const [pas, coin] = await Promise.allSettled([publicClient.getBalance({ address: me }), Promise.all([coinInfo(), coinBalance(me)])])
  $("#pas-balance").textContent = pas.status === "fulfilled" ? formatAmount(pas.value, 18, 3) : "—"
  if (coin.status === "fulfilled") {
    const [info, balance] = coin.value
    $("#coin-balance").textContent = formatAmount(balance, info.decimals)
    $("#coin-symbol").textContent = info.symbol
    error.textContent = ""
  } else {
    $("#coin-balance").textContent = "—"
    error.textContent = COIN ? "Sem ligação à rede. A tentar de novo…" : "Esta carteira foi construída sem COIN_ADDRESS."
  }
}

function renderHome() {
  show("home")
  void refreshBalances()
  clearInterval(refreshTimer)
  refreshTimer = window.setInterval(() => {
    if (!$("[data-screen=home]").hidden && document.visibilityState === "visible") void refreshBalances()
  }, 6_000)
}

/* ---------- câmara ---------- */

async function openScanner(target: "pay" | "send") {
  scanTarget = target
  $("#scan-error").textContent = ""
  show("scan")
  try {
    scanner = await startScanner($<HTMLVideoElement>("#scan-video"), (text) => {
      scanner = null
      void handleScan(text)
    })
  } catch (error) {
    $("#scan-error").textContent = errorText(error)
  }
}

$("#scan-photo").addEventListener("change", async (event) => {
  const field = event.target as HTMLInputElement
  const file = field.files?.[0]
  field.value = ""
  if (!file) return
  $("#scan-error").textContent = "a ler a foto…"
  try {
    const text = await scanImageFile(file)
    if (!text) return void ($("#scan-error").textContent = "Não encontrei nenhum código QR na foto. Tenta mais de perto e sem reflexos.")
    closeScanner()
    void handleScan(text)
  } catch (error) {
    $("#scan-error").textContent = errorText(error)
  }
})

function closeScanner() {
  scanner?.stop()
  scanner = null
}

async function handleScan(text: string) {
  const request = decodePaymentRequest(text)
  if (request) return prepareConfirm(request)
  const address = decodeAddress(text)
  if (address) {
    input("#send-to").value = address
    $("#send-error").textContent = ""
    show("send")
    input("#send-amount").focus()
    return
  }
  toast("Não percebi esse código")
  scanTarget === "send" ? show("send") : renderHome()
}

/* ---------- pagar ---------- */

async function prepareConfirm(request: PaymentRequest) {
  if (request.chainId !== chain.id) {
    toast("Esse pagamento é de outra rede")
    return renderHome()
  }
  if (!COIN || request.token.toLowerCase() !== COIN.toLowerCase()) {
    toast("Esse pagamento pede outra moeda")
    return renderHome()
  }
  try {
    const coin = await coinInfo()
    pending = { request, coin }
    const fee = feeFor(coin, request.amount, me)
    const [balance, gas] = await Promise.all([coinBalance(me), publicClient.getBalance({ address: me })])
    const fmt = (v: bigint, digits = 2) => `${formatAmount(v, coin.decimals, digits)} ${coin.symbol}`
    $("#confirm-amount").textContent = formatAmount(request.amount, coin.decimals, 4)
    $("#confirm-symbol").textContent = coin.symbol
    $("#confirm-to").textContent = short(request.to)
    $("#confirm-to").title = request.to
    $("#confirm-fee").textContent = fee === 0n ? "sem taxa" : `+ ${fmt(fee, 4)}`
    $("#confirm-total").textContent = fmt(request.amount + fee, 4)
    $("#confirm-balance").textContent = fmt(balance)
    let problem = ""
    if (balance < request.amount + fee) problem = `Não tens ${coin.symbol} suficientes.`
    else if (gas === 0n) problem = "Precisas de um pouco de PAS para pagar a rede. Mostra o teu QR (receber) a quem organiza."
    $("#confirm-error").textContent = problem
    $<HTMLButtonElement>("#confirm-go").disabled = problem !== ""
    show("confirm")
  } catch (error) {
    toast(`Não consegui ler a moeda: ${errorText(error)}`)
    renderHome()
  }
}

async function runTx(label: string, to: Address, send: () => Promise<Hash>) {
  show("pending")
  $("#pending-status").textContent = "a assinar…"
  try {
    const hash = await send()
    $("#pending-status").textContent = "à espera do bloco…"
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 })
    if (receipt.status !== "success") throw new Error("A transação falhou na cadeia.")
    $("#done-amount").textContent = label
    $("#done-to").textContent = short(to)
    $<HTMLAnchorElement>("#done-link").href = explorerTx(hash)
    navigator.vibrate?.(120)
    show("done")
  } catch (error) {
    toast(errorText(error))
    renderHome()
  }
}

function transfer(coin: Address, to: Address, amount: bigint) {
  return wallet.writeContract({ address: coin, abi: moedaAbi, functionName: "transfer", args: [to, amount] })
}

$("#confirm-go").addEventListener("click", () => {
  if (!pending) return
  const { request, coin } = pending
  pending = null
  void runTx(`${formatAmount(request.amount, coin.decimals, 4)} ${coin.symbol}`, request.to, () => transfer(coin.address, request.to, request.amount))
})

$("#confirm-cancel").addEventListener("click", () => {
  pending = null
  renderHome()
})

/* ---------- enviar ---------- */

$("#send-go").addEventListener("click", async () => {
  const error = $("#send-error")
  const to = decodeAddress(input("#send-to").value)
  if (!to) return void (error.textContent = "Endereço inválido. Começa por 0x e tem 42 caracteres.")
  try {
    const coin = await coinInfo()
    const amount = parseAmount(input("#send-amount").value, coin.decimals)
    if (amount === 0n) throw new Error("Escreve quanto queres enviar.")
    const fee = feeFor(coin, amount, me)
    if ((await coinBalance(me)) < amount + fee) throw new Error(`Não tens ${coin.symbol} suficientes (com a taxa de 1%).`)
    if ((await publicClient.getBalance({ address: me })) === 0n) throw new Error("Precisas de um pouco de PAS para pagar a rede.")
    error.textContent = ""
    await runTx(`${formatAmount(amount, coin.decimals, 4)} ${coin.symbol}`, to, () => transfer(coin.address, to, amount))
    input("#send-amount").value = ""
  } catch (e) {
    error.textContent = errorText(e)
  }
})

/* ---------- receber ---------- */

$("#go-receive").addEventListener("click", async () => {
  $("#receive-address").textContent = me
  const canvas = document.createElement("canvas")
  $("#receive-qr").replaceChildren(canvas)
  await QRCode.toCanvas(canvas, me, { margin: 0, width: 480, color: { dark: "#002f6c", light: "#ffffff" } })
  show("receive")
})

$("#receive-copy").addEventListener("click", () => void copy(me))

/* ---------- palavras ---------- */

function hideWords() {
  $("#backup-words").hidden = true
  $("#backup-words").replaceChildren()
  $("#backup-reveal").textContent = "mostrar palavras"
  $("#backup-reveal").setAttribute("aria-expanded", "false")
}

$("#go-backup").addEventListener("click", () => {
  hideWords()
  disarmImport()
  $("#backup-error").textContent = ""
  show("backup")
})

$("#backup-reveal").addEventListener("click", () => {
  const list = $("#backup-words")
  if (!list.hidden) return hideWords()
  list.replaceChildren(...mnemonic.split(" ").map((word) => Object.assign(document.createElement("li"), { textContent: word })))
  list.hidden = false
  $("#backup-reveal").textContent = "esconder palavras"
  $("#backup-reveal").setAttribute("aria-expanded", "true")
})

// O gateway .dot não deixa abrir confirm(), por isso a troca pede um segundo toque.
let armedImport: string | null = null

function disarmImport() {
  armedImport = null
  $("#backup-import-go").textContent = "importar"
}

$("#backup-import").addEventListener("input", disarmImport)

$("#backup-import-go").addEventListener("click", () => {
  const field = $<HTMLTextAreaElement>("#backup-import")
  const error = $("#backup-error")
  try {
    const phrase = checkMnemonic(field.value)
    if (phrase === mnemonic) throw new Error("Esta já é a tua carteira.")
    if (armedImport !== phrase) {
      armedImport = phrase
      error.textContent = "Atenção: sem as 12 palavras da carteira atual perdes o acesso a ela. Toca outra vez para trocar."
      $("#backup-import-go").textContent = "sim, trocar de carteira"
      return
    }
    saveMnemonic(phrase)
    useMnemonic(phrase)
    field.value = ""
    error.textContent = ""
    disarmImport()
    toast("Carteira importada")
    renderHome()
  } catch (e) {
    disarmImport()
    error.textContent = errorText(e)
  }
})

/* ---------- navegação ---------- */

$("#go-pay").addEventListener("click", () => void openScanner("pay"))
$("#send-scan").addEventListener("click", () => void openScanner("send"))
$("#scan-cancel").addEventListener("click", () => {
  closeScanner()
  scanTarget === "send" ? show("send") : renderHome()
})
$("#go-send").addEventListener("click", () => {
  $("#send-error").textContent = ""
  show("send")
})
for (const id of ["#receive-back", "#send-back", "#backup-back", "#done-home"]) $(id).addEventListener("click", renderHome)

/* ---------- links #pay= ---------- */

/** Lê um pedido de pagamento do #pay= e limpa-o do URL sem recarregar. */
function takePayLink() {
  const request = decodePaymentRequest(location.hash)
  if (request) history.replaceState(history.state, "", location.pathname + location.search)
  return request
}

window.addEventListener("hashchange", () => {
  const request = takePayLink()
  if (request) {
    closeScanner()
    void prepareConfirm(request)
  }
})

useMnemonic(mnemonic)
const linked = takePayLink()
if (linked) void prepareConfirm(linked)
else renderHome()
