import React, { useEffect, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useProcessImages, ProcessBatchResultView } from '@/features/image-processing'
import { LoadingOverlay } from '@/shared/ui'

export default function BatchProcessScreen() {
  const { uris: urisParam } = useLocalSearchParams<{ uris: string }>()
  const router = useRouter()

  const uris = useMemo<string[]>(() => {
    try {
      const raw = Array.isArray(urisParam) ? urisParam[0] : urisParam
      return JSON.parse(decodeURIComponent(raw ?? '[]'))
    } catch {
      return []
    }
  }, [urisParam])

  const { mutate: processImages, isPending, data: results, error, progress } = useProcessImages()

  // hasStarted で二重実行を防ぐ（ナビゲーション状態復元時の再マウントを含む）
  const hasStarted = useRef(false)
  useEffect(() => {
    if (uris.length > 0 && !hasStarted.current) {
      hasStarted.current = true
      processImages(uris)
    }
  }, [uris, processImages])

  const handleSelectNew = () => {
    router.back()
  }

  const progressMessage =
    progress.total > 0 ? `${progress.current} / ${progress.total} 枚処理中...` : '処理中...'

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: '処理結果', headerBackTitle: '戻る' }} />

      {isPending && <LoadingOverlay message={progressMessage} />}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>処理に失敗しました</Text>
          <Text style={styles.errorDetail}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleSelectNew}>
            <Text style={styles.retryText}>別の画像を選択</Text>
          </TouchableOpacity>
        </View>
      )}

      {results && <ProcessBatchResultView results={results} onSelectNew={handleSelectNew} />}
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
