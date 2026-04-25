import { FaceDetector, FaceNet, Mosaic } from '@/shared/native'
import { getAllEmbeddings } from '@/shared/db'
import type { Embedding } from '@/shared/db'
import { cosineSimilarity, cropFace, resizeForMosaic } from '@/shared/lib'
import { getThreshold } from '@/shared/config'

export async function processImage(uri: string, preloadedEmbeddings?: Embedding[]): Promise<string> {
  const boxes = await FaceDetector.detect(uri)
  if (boxes.length === 0) return uri

  const croppedUris = await Promise.all(boxes.map((box) => cropFace(uri, box)))
  const faceEmbeddings = await FaceNet.extractAll(croppedUris)

  if (faceEmbeddings.length !== boxes.length) {
    throw new Error(
      `[processImage] FaceNet embedding count mismatch: expected ${boxes.length}, got ${faceEmbeddings.length}`
    )
  }

  const storedEmbeddings = preloadedEmbeddings ?? (await getAllEmbeddings())

  // person_id ごとにグループ化し、いずれか1件でも閾値を超えれば一致とみなす（CLAUDE.md 照合方針）
  const embeddingsByPerson = storedEmbeddings.reduce<Record<string, number[][]>>(
    (acc, stored) => {
      let vec: number[]
      try {
        vec = JSON.parse(stored.embedding)
      } catch (e) {
        console.error('[processImage] Corrupt embedding record skipped', {
          embeddingId: stored.id,
          personId: stored.person_id,
          error: e,
        })
        return acc
      }
      ;(acc[stored.person_id] ??= []).push(vec)
      return acc
    },
    {}
  )

  const regionsToBlur = boxes.filter((_, i) =>
    Object.values(embeddingsByPerson).some((vecs) =>
      vecs.some((v) => cosineSimilarity(faceEmbeddings[i], v) > getThreshold())
    )
  )

  if (regionsToBlur.length === 0) return uri

  // Skia のデコード失敗を防ぐため ImageManipulator で正規化してから渡す
  const { uri: resizedUri, scale } = await resizeForMosaic(uri)
  const scaledRegions = regionsToBlur.map((box) => ({
    x: box.x * scale,
    y: box.y * scale,
    width: box.width * scale,
    height: box.height * scale,
  }))
  return Mosaic.apply(resizedUri, scaledRegions)
}
