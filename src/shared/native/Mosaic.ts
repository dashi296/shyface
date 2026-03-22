import { Skia, ImageFormat, TileMode, ClipOp } from '@shopify/react-native-skia'
import * as FileSystem from 'expo-file-system/legacy'
import type { BoundingBox } from './FaceDetector'

const BLUR_SIGMA = 20

export const Mosaic = {
  apply: async (uri: string, regions: BoundingBox[]): Promise<string> => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    })
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const skData = Skia.Data.fromBytes(bytes)

    const image = Skia.Image.MakeImageFromEncoded(skData)
    if (!image) throw new Error('Failed to decode image')

    const width = image.width()
    const height = image.height()

    const surface = Skia.Surface.Make(width, height)
    if (!surface) throw new Error('Failed to create surface')

    const canvas = surface.getCanvas()
    // ベース画像を描画
    canvas.drawImage(image, 0, 0)

    // 各顔領域にブラーをかける
    const blurFilter = Skia.ImageFilter.MakeBlur(BLUR_SIGMA, BLUR_SIGMA, TileMode.Clamp, null)
    const paint = Skia.Paint()
    paint.setImageFilter(blurFilter)

    for (const { x, y, width: rw, height: rh } of regions) {
      // 座標を画像サイズ内にクランプ（ML Kit が端をはみ出す座標を返すことがある）
      const clampedX = Math.floor(Math.max(0, Math.min(x, width - 1)))
      const clampedY = Math.floor(Math.max(0, Math.min(y, height - 1)))
      const clampedW = Math.floor(Math.min(rw, width - clampedX))
      const clampedH = Math.floor(Math.min(rh, height - clampedY))
      if (clampedW <= 0 || clampedH <= 0) continue

      canvas.save()
      canvas.clipRect(Skia.XYWHRect(clampedX, clampedY, clampedW, clampedH), ClipOp.Intersect, true)
      canvas.drawImage(image, 0, 0, paint)
      canvas.restore()
    }

    const result = surface.makeImageSnapshot()
    const encoded = result.encodeToBase64(ImageFormat.JPEG, 90)
    return `data:image/jpeg;base64,${encoded}`
  },
}
