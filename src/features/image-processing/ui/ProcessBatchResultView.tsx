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
      await Share.share({ url: uri })
    } catch (e) {
      // Share.share は iOS でキャンセル時に reject しない。ここに来るのは実際のエラー
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
                <View style={styles.errorOverlay}>
                  <Text style={styles.errorOverlayText}>処理失敗</Text>
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
              {item.status === 'error' && (
                <Text style={styles.errorDetailText} numberOfLines={1}>{item.error}</Text>
              )}
            </View>
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
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlayText: { color: '#FF3B30', fontSize: 16, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  imageLabel: { color: '#8E8E93', fontSize: 13 },
  shareText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  errorDetailText: { color: '#FF3B30', fontSize: 11, flex: 1, marginLeft: 8, textAlign: 'right' },
  actions: { padding: 20 },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
