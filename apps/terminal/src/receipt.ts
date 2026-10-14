const ESC = 0x1b
const GS = 0x1d

export interface Receipt {
  shop: string
  date: string
  total: string
  from: string
  sale: string
  link: string
}

/** As impressoras térmicas imprimem ASCII simples, por isso os acentos caem em vez de saírem estragados. */
function ascii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[·•]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e]/g, "?")
}

class EscPos {
  private bytes: number[] = [ESC, 0x40]

  raw(...values: number[]) {
    this.bytes.push(...values)
    return this
  }

  text(value: string) {
    for (const char of ascii(value)) this.bytes.push(char.charCodeAt(0))
    return this.raw(0x0a)
  }

  align(position: "left" | "center") {
    return this.raw(ESC, 0x61, position === "center" ? 1 : 0)
  }

  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0)
  }

  big(on: boolean) {
    return this.raw(GS, 0x21, on ? 0x11 : 0x00)
  }

  qr(data: string) {
    const payload = [...new TextEncoder().encode(data)]
    const length = payload.length + 3
    return this.raw(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0)
      .raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 6)
      .raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31)
      .raw(GS, 0x28, 0x6b, length & 0xff, length >> 8, 0x31, 0x50, 0x30, ...payload)
      .raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30)
      .raw(0x0a)
  }

  feed(lines: number) {
    return this.raw(ESC, 0x64, lines)
  }

  base64() {
    let binary = ""
    for (const byte of this.bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }
}

export function receiptEscPos(receipt: Receipt): string {
  return new EscPos()
    .align("center")
    .bold(true)
    .text("<> ACM Student Chapter")
    .text("FEUP")
    .big(true)
    .text(receipt.shop)
    .big(false)
    .bold(false)
    .text(receipt.date)
    .text("--------------------------------")
    .bold(true)
    .big(true)
    .text(receipt.total)
    .big(false)
    .bold(false)
    .text(`de ${receipt.from}`)
    .text(`venda ${receipt.sale}`)
    .text("--------------------------------")
    .qr(receipt.link)
    .text("recibo na cadeia - polkadot")
    .text("obrigado!")
    .feed(4)
    .base64()
}

/**
 * Link que entrega o recibo à app RawBT, que imprime na impressora do SUNMI.
 * A moldura do dot.li não tem allow-modals, por isso window.print() é ignorado,
 * mas tem allow-popups, que deixa o Chrome abrir um link de app a partir da moldura.
 */
export function rawbtLink(receipt: Receipt): string {
  return `intent:base64,${receiptEscPos(receipt)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}
