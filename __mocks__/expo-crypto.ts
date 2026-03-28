/**
 * Jest manual mock for expo-crypto.
 * expo-crypto はネイティブモジュールのため Jest（Node.js 環境）では動作しない。
 * Node.js 組み込みの crypto モジュールで同等の API を提供する。
 */
import { randomUUID as nodeRandomUUID } from 'crypto'

export const randomUUID = (): string => nodeRandomUUID()
