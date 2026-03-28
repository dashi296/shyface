import React from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  Share,
  Alert,
  TouchableOpacity,
} from 'react-native'
import type { ImageProcessResult } from '../model/useProcessImages'

interface ProcessBatchResultViewProps {
  results: ImageProcessResult[]
  onSelectNew: () => void
}

export function ProcessBatchResultView({ results, onSelectNew }: ProcessBatchResultViewProps) {
  const errorCount = results.filter((r) => r.status === 'error').length

  const handleShare = async (uri: string) => {
    try {
      const result = await Share.share({ url: uri })
      if (result.action === 'dismissedAction') return
    } catch (e) {
      // iOS ではキャンセル時に reject しない。
      // Android ではキャンセル時に reject することがあるため、キャンセルと実際のエラーを区別する。
      const message = e instanceof Error ? e.message : String(e)
      if (message.toLowerCase().includes('cancel')) {
        console.warn('[ProcessBatchResultView] Share dismissed via exception (Android)', { uri, error: e })
        return
      }
      console.error('[ProcessBatchResultView] Share failed', { uri, error: e })
      Alert.alert('共有エラー', '画像を共有できませんでした')
    }
  }

  return (
    <View style={styles.container}>
      {errorCount > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errorCount}枚の処理に失敗しました</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.originalUri}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={styles.resultCard}>
            <View style={styles.imageWrapper}>
              <Image source={{ uri: item.resultUri }} style={styles.image} resizeMode="cover" />
              {item.status === 'error' && (
                <View style={styles.errorBadge}>
                  <Text style={styles.errorBadgeText}>未処理</Text>
                </View>
              )}
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.imageLabel}>{index + 1}枚目</Text>
              {item.status === 'success' && (
                <TouchableOpacity onPress={() => handleShare(item.resultUri)}>
                  <Text style={styles.shareText}>共有</Text>
                </TouchableOpacity>
              )}
            </View>
            {item.status === 'error' && (
              <View style={styles.errorMessageRow}>
                <Text style={styles.errorMessageText} numberOfLines={2}>{item.error}</Text>
              </View>
            )}
          </View>
        )}
      />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={onSelectNew}>
          <Text style={styles.buttonText}>別の画像を選択</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  errorBanner: {
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorBannerText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  listContent: { padding: 16, gap: 16 },
  resultCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageWrapper: { aspectRatio: 4 / 3, position: 'relative' },
  image: { width: '100%', height: '100%' },
  errorBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  errorBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  imageLabel: { color: '#8E8E93', fontSize: 13 },
  shareText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  errorMessageRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  errorMessageText: { color: '#FF3B30', fontSize: 12 },
  actions: { padding: 20 },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
