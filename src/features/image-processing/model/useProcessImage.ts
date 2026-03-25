import { useMutation } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { processImage } from './processImage'

export function useProcessImage() {
  return useMutation({
    mutationFn: (uri: string) => processImage(uri),
    onError: (error: Error) => {
      Alert.alert('処理エラー', error.message)
    },
  })
}
