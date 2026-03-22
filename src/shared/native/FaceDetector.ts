import { NativeModules } from 'react-native'

const { FaceDetectorModule } = NativeModules

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export const FaceDetector = {
  detect: (uri: string): Promise<BoundingBox[]> =>
    FaceDetectorModule.detect(uri),
}
