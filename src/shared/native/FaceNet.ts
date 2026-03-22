import { NativeModules } from 'react-native'

const { FaceNetModule } = NativeModules

export const FaceNet = {
  extractEmbedding: (uri: string): Promise<number[]> =>
    FaceNetModule.extractEmbedding(uri),

  extractAll: (uris: string[]): Promise<number[][]> =>
    FaceNetModule.extractAll(uris),
}
