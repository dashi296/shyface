import * as ImageManipulator from 'expo-image-manipulator'
import { Image } from 'react-native'
import type { BoundingBox } from '@/shared/native'
import { FACE_CROP_PADDING } from '@/shared/config'

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

const MOSAIC_MAX_DIMENSION = 1920

/** Mosaic 処理用に画像を正規化・縮小する。
 *  常に ImageManipulator を通してプログレッシブJPEGやEXIF回転を正規化する。
 *  閾値を超える場合はリサイズも行う。 */
export async function resizeForMosaic(uri: string): Promise<{ uri: string; scale: number }> {
  const { width, height } = await getImageSize(uri)
  const maxDim = Math.max(width, height)
  const scale = maxDim <= MOSAIC_MAX_DIMENSION ? 1 : MOSAIC_MAX_DIMENSION / maxDim
  const actions: ImageManipulator.Action[] =
    scale < 1
      ? [{ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } }]
      : []
  // リサイズ不要でも必ず ImageManipulator を通して JPEG を正規化する
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.9,
  })
  return { uri: result.uri, scale }
}

export async function cropFace(uri: string, box: BoundingBox): Promise<string> {
  const { width: imgW, height: imgH } = await getImageSize(uri)

  // バウンディングボックスを 20% 拡張して顔周辺のコンテキストを含める
  // 登録・認識の両方で同じ前処理を適用することで照合精度を向上させる
  const padX = box.width * FACE_CROP_PADDING
  const padY = box.height * FACE_CROP_PADDING
  const originX = Math.max(0, Math.round(box.x - padX))
  const originY = Math.max(0, Math.round(box.y - padY))
  // 右端・下端は画像サイズ - 1 に収める（ぴったり一致すると ImageManipulator が width=0 エラーを投げる）
  const width = Math.max(1, Math.min(Math.round(box.x + box.width + padX) - originX, imgW - 1 - originX))
  const height = Math.max(1, Math.min(Math.round(box.y + box.height + padY) - originY, imgH - 1 - originY))

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width, height } }],
    { format: ImageManipulator.SaveFormat.JPEG }
  )
  return result.uri
}
