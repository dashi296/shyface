import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useProcessImage } from '@/features/image-processing'
import { ProcessResultView } from '@/features/image-processing'
import { LoadingOverlay } from '@/shared/ui'

export default function ProcessScreen() {
  const { imageId } = useLocalSearchParams<{ imageId: string }>()
  const router = useRouter()
  const uri = decodeURIComponent(imageId ?? '')

  const { mutate: processImage, isPending, data: resultUri, error, reset } = useProcessImage()

  // processImage は useMutation が返す関数でレンダーごとに参照が変わるため deps に含めない。
  // hasStarted で二重実行を防ぐ（ナビゲーション状態復元時の再マウントを含む）。
  const hasStarted = useRef(false)
  useEffect(() => {
    if (uri && !hasStarted.current) {
      hasStarted.current = true
      processImage(uri)
    }
  }, [uri]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    reset()
    router.back()
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: '処理結果', headerBackTitle: '戻る' }} />

      {isPending && <LoadingOverlay message="顔を検出しています..." />}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>画像の処理に失敗しました</Text>
          <Text style={styles.errorDetail}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryText}>別の画像を選択</Text>
          </TouchableOpacity>
        </View>
      )}

      {resultUri && (
        <ProcessResultView
          originalUri={uri}
          resultUri={resultUri}
          onRetry={handleRetry}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorText: { fontSize: 18, fontWeight: '600', color: '#FF3B30', textAlign: 'center' },
  errorDetail: { fontSize: 13, color: '#aaa', textAlign: 'center' },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
