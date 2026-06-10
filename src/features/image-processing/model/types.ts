import type { BoundingBox } from '@/shared/native'

export interface FaceCandidate {
  box: BoundingBox
  isMatched: boolean
  isSelected: boolean
}
