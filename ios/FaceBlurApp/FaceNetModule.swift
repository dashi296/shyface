import Foundation
import CoreML
import UIKit
import Vision

@objc(FaceNetModule)
class FaceNetModule: NSObject {

  private let inferenceQueue = DispatchQueue(label: "com.shyface.facenet", qos: .userInitiated)

  private lazy var model: MLModel? = {
    guard let url = Bundle.main.url(forResource: "facenet", withExtension: "mlmodelc") else {
      return nil
    }
    return try? MLModel(contentsOf: url)
  }()

  @objc
  func extractEmbedding(_ uri: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let model = model else {
      reject("MODEL_NOT_FOUND", "FaceNet model not loaded", nil)
      return
    }

    let filePath = uri.hasPrefix("file://") ? String(uri.dropFirst(7)) : uri
    guard let image = UIImage(contentsOfFile: filePath),
          let cgImage = image.cgImage else {
      reject("INVALID_URI", "Cannot load image from URI: \(uri)", nil)
      return
    }

    inferenceQueue.async {
      guard let inputArray = cgImage.toNormalizedMLArray(size: CGSize(width: 160, height: 160)) else {
        reject("PIXEL_BUFFER_FAILED", "Failed to create normalized input array", nil)
        return
      }

      do {
        let input = try MLDictionaryFeatureProvider(dictionary: ["input": MLFeatureValue(multiArray: inputArray)])
        let output = try model.prediction(from: input)
        if let embeddingValue = output.featureValue(for: "output")?.multiArrayValue {
          let embedding = (0..<embeddingValue.count).map { Double(truncating: embeddingValue[$0]) }
          resolve(embedding)
        } else {
          reject("INFERENCE_FAILED", "No output from model", nil)
        }
      } catch {
        reject("INFERENCE_FAILED", error.localizedDescription, error)
      }
    }
  }

  @objc
  func extractAll(_ uris: [String], resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let model = model else {
      reject("MODEL_NOT_FOUND", "FaceNet model not loaded", nil)
      return
    }

    inferenceQueue.async {
      var embeddings: [[Double]] = []
      for uri in uris {
        let filePath = uri.hasPrefix("file://") ? String(uri.dropFirst(7)) : uri
        guard let image = UIImage(contentsOfFile: filePath),
              let cgImage = image.cgImage else {
          reject("INVALID_URI", "Cannot load image from URI: \(uri)", nil)
          return
        }
        guard let inputArray = cgImage.toNormalizedMLArray(size: CGSize(width: 160, height: 160)) else {
          reject("PIXEL_BUFFER_FAILED", "Failed to create normalized input array for: \(uri)", nil)
          return
        }
        do {
          let input = try MLDictionaryFeatureProvider(dictionary: ["input": MLFeatureValue(multiArray: inputArray)])
          let output = try model.prediction(from: input)
          guard let embeddingValue = output.featureValue(for: "output")?.multiArrayValue else {
            reject("INFERENCE_FAILED", "No output from model for: \(uri)", nil)
            return
          }
          embeddings.append((0..<embeddingValue.count).map { Double(truncating: embeddingValue[$0]) })
        } catch {
          reject("INFERENCE_FAILED", error.localizedDescription, error)
          return
        }
      }
      resolve(embeddings)
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool { false }
}

private extension CGImage {
  /// 画像を target size にリサイズし、ピクセル値を (pixel - 128) / 128.0 で [-1, 1] に正規化した
  /// Float32 MLMultiArray [1, H, W, 3] を返す。Android FaceNetModule.kt の前処理と一致させる。
  func toNormalizedMLArray(size: CGSize) -> MLMultiArray? {
    let width = Int(size.width)
    let height = Int(size.height)

    // ARGB ピクセルバッファを作成してリサイズ描画
    var pixelBuffer: CVPixelBuffer?
    CVPixelBufferCreate(
      kCFAllocatorDefault, width, height,
      kCVPixelFormatType_32ARGB,
      [kCVPixelBufferCGImageCompatibilityKey: true,
       kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary,
      &pixelBuffer
    )
    guard let buffer = pixelBuffer else { return nil }

    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }

    let context = CGContext(
      data: CVPixelBufferGetBaseAddress(buffer),
      width: width, height: height,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
    )
    context?.draw(self, in: CGRect(origin: .zero, size: size))

    guard let baseAddress = CVPixelBufferGetBaseAddress(buffer)?.assumingMemoryBound(to: UInt8.self) else {
      return nil
    }
    let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)

    // Float32 MLMultiArray [1, H, W, 3] を作成してピクセル値を正規化
    guard let array = try? MLMultiArray(
      shape: [1, NSNumber(value: height), NSNumber(value: width), 3],
      dataType: .float32
    ) else { return nil }

    let ptr = array.dataPointer.assumingMemoryBound(to: Float32.self)
    for y in 0..<height {
      for x in 0..<width {
        // ARGB レイアウト: [A=0, R=1, G=2, B=3]
        let pixelOffset = y * bytesPerRow + x * 4
        let r = Float(baseAddress[pixelOffset + 1])
        let g = Float(baseAddress[pixelOffset + 2])
        let b = Float(baseAddress[pixelOffset + 3])
        let idx = (y * width + x) * 3
        ptr[idx]     = (r - 128.0) / 128.0
        ptr[idx + 1] = (g - 128.0) / 128.0
        ptr[idx + 2] = (b - 128.0) / 128.0
      }
    }
    return array
  }
}
