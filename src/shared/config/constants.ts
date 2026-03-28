export const FACE_SIMILARITY_THRESHOLD = 0.7

export const FACE_REGISTER_MIN_PHOTOS = 3
export const FACE_REGISTER_MAX_PHOTOS = 3

/** 顔クロップ時にバウンディングボックスを拡張する比率。登録・認識の両方で同じ値を使う */
export const FACE_CROP_PADDING = 0.1

/**
 * 照合時に上位何件の embedding スコアを平均するか。
 * 登録枚数（FACE_REGISTER_MAX_PHOTOS）以下で指定する。
 */
export const FACE_MATCH_TOP_K = 2

/** iOS / Android 共通の TFLite モデルパス（assets/models/facenet.tflite） */
export const MODEL_PATH = 'models/facenet.tflite' as const
