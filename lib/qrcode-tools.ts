export interface PaymentQrInput {
  recipient: string
  amount: string
  currency: string
  message: string
}

export function buildPaymentQrValue(input: PaymentQrInput): string {
  const params = new URLSearchParams()
  if (input.currency) params.set("currency", input.currency)
  if (input.amount) params.set("amount", input.amount)
  if (input.recipient) params.set("recipient", input.recipient)
  if (input.message) params.set("message", input.message)
  return `payment:?${params.toString()}`
}
