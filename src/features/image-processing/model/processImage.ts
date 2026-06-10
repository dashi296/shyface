import type { Embedding } from '@/shared/db'
import { detectAndClassify } from './detectAndClassify'
import { applyMosaicToSelected } from './applyMosaicToSelected'

export async function processImage(uri: string, preloadedEmbeddings?: Embedding[]): Promise<string> {
  const candidates = await detectAndClassify(uri, preloadedEmbeddings)
  if (candidates.length === 0) return uri
  return applyMosaicToSelected(uri, candidates)
}
