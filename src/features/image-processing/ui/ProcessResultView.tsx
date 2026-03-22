import React from 'react'
import { View, Image, Text, StyleSheet, Share, TouchableOpacity } from 'react-native'

interface ProcessResultViewProps {
  originalUri: string
  resultUri: string
  onRetry?: () => void
}

export function ProcessResultView({ originalUri, resultUri, onRetry }: ProcessResultViewProps) {
  const handleShare = async () => {
    try {
      await Share.share({ url: resultUri })
    } catch {
      // share cancelled
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.imageWrapper}>
        <Image source={{ uri: resultUri }} style={styles.image} resizeMode="contain" />
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={handleShare}>
          <Text style={styles.buttonText}>共有する</Text>
        </TouchableOpacity>
        {onRetry && (
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onRetry}>
            <Text style={[styles.buttonText, styles.secondaryText]}>別の画像を選択</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  imageWrapper: { flex: 1, backgroundColor: '#000' },
  image: { flex: 1, width: '100%' },
  actions: { padding: 20, gap: 12 },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButton: { backgroundColor: '#f0f0f0' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryText: { color: '#333' },
})
