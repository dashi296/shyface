import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite'
import { Skia, AlphaType, ColorType } from '@shopify/react-native-skia'
import * as FileSystem from 'expo-file-system/legacy'

const MODEL_INPUT_SIZE = 160

let modelPromise: Promise<TensorflowModel> | null = null

function getModel(): Promise<TensorflowModel> {
  if (!modelPromise) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modelPromise = loadTensorflowModel(require('../../../assets/models/facenet.tflite'))
  }
  return modelPromise
}

async function uriToFloat32Input(uri: string): Promise<Float32Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const skData = Skia.Data.fromBytes(bytes)

  const srcImage = Skia.Image.MakeImageFromEncoded(skData)
  if (!srcImage) throw new Error('Failed to decode image')

  // Resize to MODEL_INPUT_SIZE x MODEL_INPUT_SIZE via Skia surface
  const surface = Skia.Surface.Make(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
  if (!surface) throw new Error('Failed to create Skia surface')

  const canvas = surface.getCanvas()
  const paint = Skia.Paint()
  canvas.drawImageRect(
    srcImage,
    Skia.XYWHRect(0, 0, srcImage.width(), srcImage.height()),
    Skia.XYWHRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE),
    paint,
  )
  const resized = surface.makeImageSnapshot()

  // Read raw RGBA pixels
  const pixels = resized.readPixels(0, 0, {
    width: MODEL_INPUT_SIZE,
    height: MODEL_INPUT_SIZE,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  })
  if (!pixels) throw new Error('Failed to read pixels from resized image')

  // Normalize each pixel to [-1, 1]: (value - 128) / 128
  // Layout: RGBA → RGB only, shape [1, H, W, 3]
  const pixelBytes = pixels as Uint8Array
  const input = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3)
  for (let i = 0; i < MODEL_INPUT_SIZE * MODEL_INPUT_SIZE; i++) {
    input[i * 3] = (pixelBytes[i * 4] - 128) / 128 // R
    input[i * 3 + 1] = (pixelBytes[i * 4 + 1] - 128) / 128 // G
    input[i * 3 + 2] = (pixelBytes[i * 4 + 2] - 128) / 128 // B
  }
  return input
}

export const FaceNet = {
  extractEmbedding: async (uri: string): Promise<number[]> => {
    const model = await getModel()
    const input = await uriToFloat32Input(uri)
    const outputs = await model.run([input])
    return Array.from(outputs[0] as Float32Array)
  },

  extractAll: async (uris: string[]): Promise<number[][]> => {
    return Promise.all(uris.map((uri) => FaceNet.extractEmbedding(uri)))
  },
}
