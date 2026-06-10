import { FaceDetector, FaceNet } from '@/shared/native'
import { getAllEmbeddings } from '@/shared/db'
import type { Embedding } from '@/shared/db'
import { cosineSimilarity, cropFace } from '@/shared/lib'
import { getThreshold } from '@/shared/config'
import type { FaceCandidate } from './types'

export async function detectAndClassify(
  uri: string,
  preloadedEmbeddings?: Embedding[]
): Promise<FaceCandidate[]> {
  const boxes = await FaceDetector.detect(uri)
  if (boxes.length === 0) return []

  const croppedUris = await Promise.all(boxes.map((box) => cropFace(uri, box)))
  const faceEmbeddings = await FaceNet.extractAll(croppedUris)

  if (faceEmbeddings.length !== boxes.length) {
    throw new Error(
      `[detectAndClassify] FaceNet embedding count mismatch: expected ${boxes.length}, got ${faceEmbeddings.length}`
    )
  }

  const storedEmbeddings = preloadedEmbeddings ?? (await getAllEmbeddings())

  const embeddingsByPerson = storedEmbeddings.reduce<Record<string, number[][]>>(
    (acc, stored) => {
      let vec: number[]
      try {
        vec = JSON.parse(stored.embedding)
      } catch (e) {
        console.error('[detectAndClassify] Corrupt embedding record skipped', {
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

  return boxes.map((box, i) => {
    const isMatched = Object.values(embeddingsByPerson).some((vecs) =>
      vecs.some((v) => cosineSimilarity(faceEmbeddings[i], v) > getThreshold())
    )
    return { box, isMatched, isSelected: isMatched }
  })
}
