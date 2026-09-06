export type VectorSample = "icon" | "illustration" | "gradient"
export async function createVectorSample(type: VectorSample): Promise<File> {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = type === "illustration" ? 768 : 512
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas unavailable")
  if (type === "illustration") {
    const picture = new Image()
    await new Promise<void>((resolve, reject) => { picture.onload = () => resolve(); picture.onerror = reject; picture.src = "/mascot.svg?v=5" })
    context.drawImage(picture, 0, 0, canvas.width, canvas.height)
  } else if (type === "icon") {
    context.fillStyle = "#40702e"
    context.beginPath(); context.roundRect(56, 56, 400, 400, 96); context.fill()
    context.globalCompositeOperation = "destination-out"
    context.beginPath(); context.arc(256, 256, 108, 0, Math.PI * 2); context.fill()
    context.globalCompositeOperation = "source-over"
    context.strokeStyle = "#aacf96"; context.lineWidth = 20; context.lineCap = "round"
    context.beginPath(); context.moveTo(207, 250); context.lineTo(245, 287); context.lineTo(316, 215); context.stroke()
  } else {
    const gradient = context.createLinearGradient(0, 0, 512, 512)
    gradient.addColorStop(0, "#fff2b8"); gradient.addColorStop(0.4, "#39bbad"); gradient.addColorStop(1, "#172e67")
    context.fillStyle = gradient; context.fillRect(0, 0, 512, 512)
    const glow = context.createRadialGradient(220, 190, 10, 260, 230, 170)
    glow.addColorStop(0, "white"); glow.addColorStop(0.6, "rgba(252,109,119,.6)"); glow.addColorStop(1, "rgba(255,255,255,0)")
    context.fillStyle = glow; context.fillRect(0, 0, 512, 512)
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image encoding failed")), "image/png"))
  canvas.width = canvas.height = 1
  return new File([blob], `sample-${type}.png`, { type: "image/png" })
}
