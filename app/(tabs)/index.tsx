import React, { useCallback } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Button } from '@/shared/ui'

export default function HomeScreen() {
  const router = useRouter()

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 1,
        allowsMultipleSelection: true,
        selectionLimit: 20,
      })
      if (!result.canceled && result.assets.length > 0) {
        const uris = result.assets.map((a) => a.uri)
        router.push({
          pathname: '/process/batch',
          params: { uris: encodeURIComponent(JSON.stringify(uris)) },
        })
      }
    } catch (e: unknown) {
      console.error('[HomeScreen] launchImageLibraryAsync failed', { error: e })
      Alert.alert('エラー', '画像を選択できませんでした。もう一度お試しください。')
    }
  }, [router])

  const handleCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('権限が必要です', 'カメラへのアクセスを許可してください')
        return
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 1 })
      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri
        router.push({ pathname: '/process/[imageId]', params: { imageId: encodeURIComponent(uri) } })
      }
    } catch (e: unknown) {
      console.error('[HomeScreen] launchCameraAsync failed', { error: e })
      Alert.alert('エラー', '写真を撮影できませんでした。もう一度お試しください。')
    }
  }, [router])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>顔を自動で隠します</Text>
      <Text style={styles.subtitle}>登録された人物の顔のみモザイクをかけます</Text>
      <View style={styles.actions}>
        <Button title="カメラで撮影" onPress={handleCamera} style={styles.button} />
        <Button title="ライブラリから選択" onPress={handlePickImage} variant="secondary" style={styles.button} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#000', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 16 },
  actions: { width: '100%', gap: 12 },
  button: { width: '100%' },
})
