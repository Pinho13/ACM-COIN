export function $<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) {
  const el = root.querySelector<T>(selector)
  if (!el) throw new Error(`missing element ${selector}`)
  return el
}

/** Troca de ecrã sem navegar: o gateway .dot perde os parâmetros se a página recarregar. */
export function show(id: string) {
  document.querySelectorAll<HTMLElement>("[data-screen]").forEach((el) => {
    el.hidden = el.dataset.screen !== id
  })
  window.scrollTo(0, 0)
  const heading = document.querySelector<HTMLElement>(`[data-screen="${id}"] h1, [data-screen="${id}"] h2`)
  heading?.setAttribute("tabindex", "-1")
  heading?.focus({ preventScroll: true })
}

export function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function toast(message: string) {
  let region = document.getElementById("toasts")
  if (!region) {
    region = document.createElement("div")
    region.id = "toasts"
    region.setAttribute("role", "status")
    region.setAttribute("aria-live", "polite")
    document.body.append(region)
  }
  const el = document.createElement("div")
  el.className = "toast"
  el.textContent = message
  region.append(el)
  setTimeout(() => el.remove(), 2800)
}

export async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast("Copiado")
  } catch {
    toast(value)
  }
}

export function errorText(error: unknown) {
  const e = error as { shortMessage?: string; details?: string; message?: string }
  return e.shortMessage ?? e.details ?? e.message ?? String(error)
}
