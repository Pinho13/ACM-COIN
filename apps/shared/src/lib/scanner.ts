import jsQR from "jsqr"

export interface Scanner {
  stop(): void
}

const HOST_TIMEOUT_MS = 3_000

/** O gateway .dot só dá a câmara à moldura depois de a permissão estar em "Allowed". */
export const CAMERA_HELP =
  "Ativa a câmara no gateway: toca no escudo ao lado do nome da app na barra de cima, põe Camera em Allowed e recarrega a página. Ou usa “tirar foto do código”."

/**
 * Dentro do gateway .dot pede a câmara ao host com requestDevicePermission("Camera").
 * Se o host não responder (versões diferentes do protocolo), segue em frente ao fim de uns segundos.
 */
async function askHostForCamera() {
  const ask = (async () => {
    const host = await import("@parity/product-sdk-host")
    if (!(await host.isInsideContainer())) return
    await host.requestDevicePermission("Camera")
  })().catch(() => undefined)
  await Promise.race([ask, new Promise((resolve) => setTimeout(resolve, HOST_TIMEOUT_MS))])
}

function cameraBlockedByFrame() {
  const policy = (document as Document & { featurePolicy?: { allowsFeature(feature: string): boolean } }).featurePolicy
  return window.self !== window.top && policy?.allowsFeature("camera") === false
}

function cameraError(error: unknown): Error {
  const name = (error as { name?: string }).name
  if (name === "NotAllowedError" || name === "SecurityError") return new Error(CAMERA_HELP)
  if (name === "NotFoundError" || name === "OverconstrainedError") return new Error("Não encontrei nenhuma câmara neste aparelho.")
  if (name === "NotReadableError") return new Error("A câmara está a ser usada por outra app.")
  return error instanceof Error ? error : new Error(String(error))
}

function decode(context: CanvasRenderingContext2D, width: number, height: number) {
  const image = context.getImageData(0, 0, width, height)
  return jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data ?? null
}

export async function startScanner(video: HTMLVideoElement, onResult: (text: string) => void): Promise<Scanner> {
  await askHostForCamera()
  if (cameraBlockedByFrame()) throw new Error(CAMERA_HELP)
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este browser não dá acesso à câmara. Usa “tirar foto do código”.")

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
  } catch (error) {
    throw cameraError(error)
  }
  video.srcObject = stream
  video.setAttribute("playsinline", "true")
  video.muted = true
  await video.play()

  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })!
  let running = true
  let frame = 0

  const stop = () => {
    running = false
    cancelAnimationFrame(frame)
    stream.getTracks().forEach((track) => track.stop())
    video.srcObject = null
  }

  const tick = () => {
    if (!running) return
    if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const text = decode(context, canvas.width, canvas.height)
      if (text) {
        stop()
        onResult(text)
        return
      }
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return { stop }
}

/** Lê um QR de uma foto. Funciona mesmo quando o gateway não dá a câmara à moldura. */
export async function scanImageFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })!
  // Fotos grandes tentam-se em vários tamanhos: um QR pequeno precisa de resolução, um grande lê-se mais depressa reduzido.
  for (const max of [1024, 1600, 2400]) {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const text = decode(context, canvas.width, canvas.height)
    if (text) {
      bitmap.close()
      return text
    }
    if (scale === 1) break
  }
  bitmap.close()
  return null
}
