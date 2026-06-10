import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useFaceSelection, FaceSelectionView, ProcessResultView } from '@/features/image-processing'
import { LoadingOverlay } from '@/shared/ui'

export default function ProcessScreen() {
  const { imageId } = useLocalSearchParams<{ imageId: string }>()
  const router = useRouter()
  const uri = decodeURIComponent(imageId ?? '')

  const { phase, candidates, resultUri, error, toggleFace, confirm } = useFaceSelection(uri)

  const handleRetry = () => router.back()

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: '処理結果', headerBackTitle: '戻る' }} />

      {phase === 'detecting' && <LoadingOverlay message="顔を検出しています..." />}

      {phase === 'selecting' && (
        <FaceSelectionView
          uri={uri}
          candidates={candidates}
          onToggle={toggleFace}
          onConfirm={confirm}
        />
      )}

      {phase === 'processing' && <LoadingOverlay message="モザイクを適用しています..." />}

      {phase === 'done' && resultUri && (
        <ProcessResultView
          originalUri={uri}
          resultUri={resultUri}
          onRetry={handleRetry}
        />
      )}

      {phase === 'error' && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error?.message ?? '画像の処理に失敗しました'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryText}>別の画像を選択</Text>
          </TouchableOpacity>
        </View>
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
  retryButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
