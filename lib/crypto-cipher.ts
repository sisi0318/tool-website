import CryptoJS from "crypto-js"

export type SupportedCryptoAlgorithm =
  | "aes"
  | "des"
  | "tripledes"
  | "rc4"
  | "rabbit"

function getCipherOptions(
  mode: string,
  iv: CryptoJS.lib.WordArray | null,
): CryptoJS.lib.CipherCfg {
  const options: CryptoJS.lib.CipherCfg = {
    padding:
      mode === "CBC" || mode === "ECB"
        ? CryptoJS.pad.Pkcs7
        : CryptoJS.pad.NoPadding,
  }

  if (mode === "CBC") options.mode = CryptoJS.mode.CBC
  else if (mode === "ECB") options.mode = CryptoJS.mode.ECB
  else if (mode === "CFB") options.mode = CryptoJS.mode.CFB
  else if (mode === "OFB") options.mode = CryptoJS.mode.OFB
  else if (mode === "CTR") options.mode = CryptoJS.mode.CTR
  if (iv) options.iv = iv
  return options
}

export function encryptCryptoWordArray(
  algorithm: SupportedCryptoAlgorithm,
  data: CryptoJS.lib.WordArray,
  key: CryptoJS.lib.WordArray,
  iv: CryptoJS.lib.WordArray | null,
  mode: string,
): CryptoJS.lib.WordArray {
  const options = getCipherOptions(mode, iv)
  if (algorithm === "aes") return CryptoJS.AES.encrypt(data, key, options).ciphertext
  if (algorithm === "des") return CryptoJS.DES.encrypt(data, key, options).ciphertext
  if (algorithm === "tripledes") {
    return CryptoJS.TripleDES.encrypt(data, key, options).ciphertext
  }
  if (algorithm === "rc4") return CryptoJS.RC4.encrypt(data, key).ciphertext
  return CryptoJS.Rabbit.encrypt(data, key, iv ? { iv } : undefined).ciphertext
}

export function decryptCryptoWordArray(
  algorithm: SupportedCryptoAlgorithm,
  ciphertext: CryptoJS.lib.WordArray,
  key: CryptoJS.lib.WordArray,
  iv: CryptoJS.lib.WordArray | null,
  mode: string,
): CryptoJS.lib.WordArray {
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext })
  const options = getCipherOptions(mode, iv)
  let result: CryptoJS.lib.WordArray

  if (algorithm === "aes") result = CryptoJS.AES.decrypt(cipherParams, key, options)
  else if (algorithm === "des") {
    result = CryptoJS.DES.decrypt(cipherParams, key, options)
  } else if (algorithm === "tripledes") {
    result = CryptoJS.TripleDES.decrypt(cipherParams, key, options)
  } else if (algorithm === "rc4") {
    result = CryptoJS.RC4.decrypt(cipherParams, key)
  } else {
    result = CryptoJS.Rabbit.decrypt(cipherParams, key, iv ? { iv } : undefined)
  }

  if (result.sigBytes <= 0) throw new Error("crypto-empty-decryption")
  return result
}
