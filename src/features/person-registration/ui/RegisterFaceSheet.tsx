import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Button } from '@/shared/ui'
import { FACE_REGISTER_MAX_PHOTOS } from '@/shared/config'
import { useRegisterPerson } from '../model/useRegisterPerson'

interface RegisterFaceSheetProps {
  visible: boolean
  onClose: () => void
}

type Step = 'form' | 'photos' | 'confirm'

export function RegisterFaceSheet({ visible, onClose }: RegisterFaceSheetProps) {
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [memo, setMemo] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const { mutate: registerPerson, isPending } = useRegisterPerson()

  const reset = useCallback(() => {
    setStep('form')
    setName('')
    setMemo('')
    setPhotos([])
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleAddPhoto = useCallback(async () => {
    try {
      const remaining = FACE_REGISTER_MAX_PHOTOS - photos.length
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 1,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      })
      if (!result.canceled && result.assets.length > 0) {
        const newUris = result.assets.map((a) => a.uri)
        setPhotos((prev) => [...prev, ...newUris].slice(0, FACE_REGISTER_MAX_PHOTOS))
      }
    } catch (e: unknown) {
      console.error('[RegisterFaceSheet] launchImageLibraryAsync failed', { error: e })
      Alert.alert('ライブラリエラー', '写真を選択できませんでした。もう一度お試しください。')
    }
  }, [photos.length])

  const handleCamera = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (perm.status !== 'granted') {
        Alert.alert('カメラ権限が必要です')
        return
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 1 })
      if (!result.canceled && result.assets.length > 0) {
        setPhotos((prev) => [...prev, result.assets[0].uri].slice(0, FACE_REGISTER_MAX_PHOTOS))
      }
    } catch (e: unknown) {
      console.error('[RegisterFaceSheet] launchCameraAsync failed', { error: e })
      Alert.alert('カメラエラー', '写真を撮影できませんでした。もう一度お試しください。')
    }
  }, [])

  const handleConfirm = useCallback(() => {
    registerPerson(
      { name, memo, photoUris: photos },
      {
        onSuccess: () => {
          reset()
          onClose()
        },
      }
    )
  }, [name, memo, photos, registerPerson, reset, onClose])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === 'form' ? '人物を登録' : step === 'photos' ? '写真を追加' : '確認'}
          </Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancel}>キャンセル</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {step === 'form' && (
            <>
              <Text style={styles.label}>名前 *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="例: 山田 太郎"
                autoFocus
              />
              <Text style={styles.label}>メモ（任意）</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={memo}
                onChangeText={setMemo}
                placeholder="備考など"
                multiline
                numberOfLines={3}
              />
              <Button
                title="次へ"
                onPress={() => setStep('photos')}
                disabled={!name.trim()}
                style={styles.button}
              />
            </>
          )}

          {step === 'photos' && (
            <>
              <Text style={styles.hint}>
                顔写真を {FACE_REGISTER_MAX_PHOTOS} 枚追加してください（{photos.length}/{FACE_REGISTER_MAX_PHOTOS}）
              </Text>
              <View style={styles.photoGrid}>
                {photos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.photo} />
                ))}
              </View>
              <View style={styles.row}>
                <Button title="カメラ" onPress={handleCamera} style={styles.halfButton} disabled={photos.length >= FACE_REGISTER_MAX_PHOTOS} />
                <Button title="ライブラリ" onPress={handleAddPhoto} style={styles.halfButton} disabled={photos.length >= FACE_REGISTER_MAX_PHOTOS} />
              </View>
              <Button
                title="確認へ"
                onPress={() => setStep('confirm')}
                disabled={photos.length < FACE_REGISTER_MAX_PHOTOS}
                style={styles.button}
              />
            </>
          )}

          {step === 'confirm' && (
            <>
              <Text style={styles.label}>名前</Text>
              <Text style={styles.value}>{name}</Text>
              {memo ? (
                <>
                  <Text style={styles.label}>メモ</Text>
                  <Text style={styles.value}>{memo}</Text>
                </>
              ) : null}
              <Text style={styles.label}>写真</Text>
              <View style={styles.photoGrid}>
                {photos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.photo} />
                ))}
              </View>
              <Button
                title="登録する"
                onPress={handleConfirm}
                loading={isPending}
                style={styles.button}
              />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  title: { fontSize: 18, fontWeight: '600' },
  cancel: { fontSize: 16, color: '#007AFF' },
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 8 },
  label: { fontSize: 13, color: '#666', fontWeight: '500', marginTop: 12 },
  value: { fontSize: 16, color: '#000' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  button: { marginTop: 24, width: '100%' },
  hint: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 8 },
  photoGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  photo: { width: 100, height: 100, borderRadius: 8 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  halfButton: { flex: 1 },
})
