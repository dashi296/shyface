import * as ImageManipulator from 'expo-image-manipulator'
import { Image } from 'react-native'
import type { BoundingBox } from '@/shared/native'

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject)
  )
}

export function uriToFilePath(uri: string): string {
  return uri.replace('file://', '')
}

export function isFileUri(uri: string): boolean {
  return uri.startsWith('file://')
}

export async function cropFace(uri: string, box: BoundingBox): Promise<string> {
  const { width: imgW, height: imgH } = await getImageSize(uri)

  const originX = Math.max(0, Math.round(box.x))
  const originY = Math.max(0, Math.round(box.y))
  // 右端・下端は画像サイズ - 1 に収める（ぴったり一致すると ImageManipulator が width=0 エラーを投げる）
  const width = Math.max(1, Math.min(Math.round(box.width), imgW - 1 - originX))
  const height = Math.max(1, Math.min(Math.round(box.height), imgH - 1 - originY))

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width, height } }],
    { format: ImageManipulator.SaveFormat.JPEG }
  )
  return result.uri
}
