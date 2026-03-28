import { useMutation } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { processImage } from './processImage'

export function useProcessImage() {
  return useMutation({
    mutationFn: (uri: string) => processImage(uri),
    onError: (error: Error) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[useProcessImage] processImage failed', { error })
      Alert.alert('処理エラー', message)
    },
  })
}
