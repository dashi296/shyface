export const FACE_SIMILARITY_THRESHOLD = 0.6

export const FACE_REGISTER_MIN_PHOTOS = 3
export const FACE_REGISTER_MAX_PHOTOS = 3

/** iOS: VNFaceObservation.confidence の閾値（0.0〜1.0）。この値未満の検出結果を除外する */
export const FACE_DETECTION_CONFIDENCE_THRESHOLD = 0.5

/** Android: ML Kit に渡す最小顔サイズ比率（画像の短辺に対する顔の幅の比率）。
 *  小さすぎる検出（誤検出の可能性が高い）を除外する */
export const FACE_DETECTION_MIN_FACE_SIZE = 0.1

/** 顔クロップ時にバウンディングボックスを拡張する比率。登録・認識の両方で同じ値を使う */
export const FACE_CROP_PADDING = 0.2

export const MODEL_PATH = {
  ios: 'models/ios/facenet.mlmodel',
  android: 'models/android/facenet.tflite',
} as const
