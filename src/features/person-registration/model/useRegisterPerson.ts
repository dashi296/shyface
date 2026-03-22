import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-native'
import * as Crypto from 'expo-crypto'
import { FaceDetector, FaceNet } from '@/shared/native'
import { insertPerson, insertEmbedding, withTransaction } from '@/shared/db'
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
        // 複数顔が検出された場合はバウンディングボックス面積が最大の顔を選択する
        const largestBox = boxes.reduce((max, box) =>
          box.width * box.height > max.width * max.height ? box : max
        )
        croppedUris.push(await cropFace(uri, largestBox))
      }

      // FaceNet を先に実行し、失敗時は DB に書かない
      const embeddings = await FaceNet.extractAll(croppedUris)

      const now = new Date().toISOString()
      const personId = Crypto.randomUUID()

      // insertPerson と insertEmbedding をトランザクションで包む
      // embedding の途中失敗で person だけ残る孤立レコードを防ぐ
      await withTransaction(async () => {
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
      })

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
