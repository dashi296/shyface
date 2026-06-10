import { Mosaic } from '@/shared/native'
import { resizeForMosaic } from '@/shared/lib'
import type { FaceCandidate } from './types'

export async function applyMosaicToSelected(
  uri: string,
  candidates: FaceCandidate[]
): Promise<string> {
  const selected = candidates.filter((c) => c.isSelected)
  if (selected.length === 0) return uri

  const { uri: resizedUri, scale } = await resizeForMosaic(uri)
  const scaledRegions = selected.map(({ box }) => ({
    x: box.x * scale,
    y: box.y * scale,
    width: box.width * scale,
    height: box.height * scale,
  }))
  return Mosaic.apply(resizedUri, scaledRegions)
}
