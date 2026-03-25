import { useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { getAllEmbeddings } from '@/shared/db'
import { processImage } from './processImage'

export type ImageProcessResult = {
  originalUri: string
  resultUri: string
  error?: string
}

export type ProcessProgress = {
  current: number
  total: number
}

export function useProcessImages() {
  const [progress, setProgress] = useState<ProcessProgress>({ current: 0, total: 0 })
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const mutation = useMutation({
    mutationFn: async (uris: string[]): Promise<ImageProcessResult[]> => {
      // バッチ処理全体で共通のEmbeddingを事前取得（N回のDB読み込みを1回に削減）
      const storedEmbeddings = await getAllEmbeddings()

      if (isMountedRef.current) setProgress({ current: 0, total: uris.length })

      const results: ImageProcessResult[] = []
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        try {
          const resultUri = await processImage(uri, storedEmbeddings)
          results.push({ originalUri: uri, resultUri })
        } catch (e) {
          results.push({ originalUri: uri, resultUri: uri, error: (e as Error).message })
        }
        if (isMountedRef.current) setProgress({ current: i + 1, total: uris.length })
      }

      return results
    },
    onError: (error: Error) => {
      Alert.alert('処理エラー', error.message)
    },
  })

  return { ...mutation, progress }
}
