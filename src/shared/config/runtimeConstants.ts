import Constants from 'expo-constants'
import { FACE_SIMILARITY_THRESHOLD, FACE_CROP_PADDING } from './constants'
import { useDevOverrides } from './devOverrides'

const IS_DEV = Constants.expoConfig?.extra?.isDev === true

export function getThreshold(): number {
  if (!IS_DEV) return FACE_SIMILARITY_THRESHOLD
  return useDevOverrides.getState().threshold ?? FACE_SIMILARITY_THRESHOLD
}

export function getPadding(): number {
  if (!IS_DEV) return FACE_CROP_PADDING
  return useDevOverrides.getState().padding ?? FACE_CROP_PADDING
}
