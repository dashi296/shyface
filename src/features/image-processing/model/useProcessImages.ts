import { useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { getAllEmbeddings } from '@/shared/db'
import { processImage } from './processImage'

export type ImageProcessResult =
  | { status: 'success'; originalUri: string; resultUri: string }
  | { status: 'error'; originalUri: string; resultUri: string; error: string }

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
      if (uris.length === 0) return []

      // バッチ処理全体で共通のEmbeddingを事前取得（N回のDB読み込みを1回に削減）
      const storedEmbeddings = await getAllEmbeddings()
      if (storedEmbeddings.length === 0) {
        console.warn('[useProcessImages] getAllEmbeddings returned empty — no face matching will occur')
      }

      const results: ImageProcessResult[] = []
      for (let i = 0; i < uris.length; i++) {
        if (isMountedRef.current) setProgress({ current: i + 1, total: uris.length })
        const uri = uris[i]
        try {
          const resultUri = await processImage(uri, storedEmbeddings)
          results.push({ status: 'success', originalUri: uri, resultUri })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          console.error('[useProcessImages] Failed to process image', { uri, error: e })
          results.push({ status: 'error', originalUri: uri, resultUri: uri, error: message })
        }
      }

      return results
    },
    onError: (error: Error) => {
      // 画像処理単位のエラーはループ内でキャッチし results に格納する。
      // ここに到達するのは getAllEmbeddings など前処理の失敗時のみ。
      // ネイティブ層が非 Error を throw する場合も考慮して防御的に処理する
      console.error('[useProcessImages] Pre-processing step failed', { error })
      Alert.alert('処理エラー', 'データの読み込みに失敗しました。アプリを再起動してもう一度お試しください。')
    },
  })

  return { ...mutation, progress }
}
