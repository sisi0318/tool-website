declare module "crypto-js" {
  namespace CryptoJS {
    interface CipherOption {
      iv?: lib.WordArray
      mode?: unknown
      padding?: unknown
    }

    namespace lib {
      interface WordArray {
        words: number[]
        sigBytes: number
        concat(wordArray: WordArray): WordArray
        clamp(): void
        clone(): WordArray
        toString(encoder?: unknown): string
      }

      interface CipherParams {
        ciphertext: WordArray
        key?: WordArray
        iv?: WordArray
        salt?: WordArray
        algorithm?: unknown
        mode?: unknown
        padding?: unknown
        blockSize?: number
        formatter?: unknown
        toString(formatter?: unknown): string
      }

      interface CipherCfg extends CipherOption {}
    }
  }

  const CryptoJS: any
  export = CryptoJS
}
