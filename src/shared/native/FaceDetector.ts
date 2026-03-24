import FaceDetection from '@react-native-ml-kit/face-detection'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export const FaceDetector = {
  detect: async (uri: string): Promise<BoundingBox[]> => {
    const faces = await FaceDetection.detect(uri)
    return faces.map((face) => ({
      x: face.frame.left,
      y: face.frame.top,
      width: face.frame.width,
      height: face.frame.height,
    }))
  },
}
