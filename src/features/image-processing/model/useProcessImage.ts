import { useMutation } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { FaceDetector, FaceNet, Mosaic } from '@/shared/native'
import { getAllEmbeddings } from '@/shared/db'
import { cosineSimilarity, cropFace } from '@/shared/lib'
import { FACE_SIMILARITY_THRESHOLD } from '@/shared/config'

export function useProcessImage() {
  return useMutation({
    mutationFn: async (uri: string): Promise<string> => {
      const boxes = await FaceDetector.detect(uri)
      if (boxes.length === 0) return uri

      const croppedUris = await Promise.all(boxes.map((box) => cropFace(uri, box)))
      const faceEmbeddings = await FaceNet.extractAll(croppedUris)
      const storedEmbeddings = await getAllEmbeddings()

      // person_id ごとにグループ化して平均類似度で判定（1枚の偶然の一致を防ぐ）
      const embeddingsByPerson = storedEmbeddings.reduce<Record<string, number[][]>>(
        (acc, stored) => {
          const vec: number[] = JSON.parse(stored.embedding)
          ;(acc[stored.person_id] ??= []).push(vec)
          return acc
        },
        {}
      )

      const regionsToBlur = boxes.filter((_, i) => {
        const faceEmbedding = faceEmbeddings[i]
        if (!faceEmbedding) return false

        return Object.values(embeddingsByPerson).some((vecs) => {
          const avgSim = vecs.reduce((sum, v) => sum + cosineSimilarity(faceEmbedding, v), 0) / vecs.length
          return avgSim > FACE_SIMILARITY_THRESHOLD
        })
      })

      if (regionsToBlur.length === 0) return uri

      return Mosaic.apply(uri, regionsToBlur)
    },
    onError: (error: Error) => {
      Alert.alert('処理エラー', error.message)
    },
  })
}
