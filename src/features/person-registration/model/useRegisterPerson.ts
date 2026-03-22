import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-native'
import * as Crypto from 'expo-crypto'
import { FaceDetector, FaceNet } from '@/shared/native'
import { insertPerson, insertEmbedding } from '@/shared/db'
import { cropFace } from '@/shared/lib'

interface RegisterPersonInput {
  name: string
  memo: string
  photoUris: string[]
}

export function useRegisterPerson() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, memo, photoUris }: RegisterPersonInput) => {
      // 各写真から顔を検出してクロップ（処理時と同じ前処理にする）
      const croppedUris: string[] = []
      for (const uri of photoUris) {
        const boxes = await FaceDetector.detect(uri)
        if (boxes.length === 0) throw new Error('写真から顔が検出できませんでした。顔が正面を向いた写真を使用してください。')
        croppedUris.push(await cropFace(uri, boxes[0]))
      }

      // FaceNet を先に実行し、失敗時は DB に書かない
      const embeddings = await FaceNet.extractAll(croppedUris)

      const now = new Date().toISOString()
      const personId = Crypto.randomUUID()

      await insertPerson({ id: personId, name, memo: memo || null, created_at: now, updated_at: now })

      for (let i = 0; i < embeddings.length; i++) {
        await insertEmbedding({
          id: Crypto.randomUUID(),
          person_id: personId,
          embedding: JSON.stringify(embeddings[i]),
          source_uri: photoUris[i],
          created_at: now,
          updated_at: now,
        })
      }

      return personId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['persons'] })
    },
    onError: (error: Error) => {
      Alert.alert('登録エラー', error.message)
    },
  })
}
