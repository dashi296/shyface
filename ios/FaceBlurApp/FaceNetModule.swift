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
      guard let pixelBuffer = cgImage.toPixelBuffer(size: CGSize(width: 160, height: 160)) else {
        reject("PIXEL_BUFFER_FAILED", "Failed to create pixel buffer", nil)
        return
      }

      do {
        let input = try MLDictionaryFeatureProvider(dictionary: ["input": MLFeatureValue(pixelBuffer: pixelBuffer)])
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
        guard let pixelBuffer = cgImage.toPixelBuffer(size: CGSize(width: 160, height: 160)) else {
          reject("PIXEL_BUFFER_FAILED", "Failed to create pixel buffer for: \(uri)", nil)
          return
        }
        do {
          let input = try MLDictionaryFeatureProvider(dictionary: ["input": MLFeatureValue(pixelBuffer: pixelBuffer)])
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
  func toPixelBuffer(size: CGSize) -> CVPixelBuffer? {
    var pixelBuffer: CVPixelBuffer?
    let attrs: [CFString: Any] = [
      kCVPixelBufferCGImageCompatibilityKey: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey: true,
    ]
    CVPixelBufferCreate(
      kCFAllocatorDefault,
      Int(size.width),
      Int(size.height),
      kCVPixelFormatType_32ARGB,
      attrs as CFDictionary,
      &pixelBuffer
    )
    guard let buffer = pixelBuffer else { return nil }
    CVPixelBufferLockBaseAddress(buffer, [])
    let context = CGContext(
      data: CVPixelBufferGetBaseAddress(buffer),
      width: Int(size.width),
      height: Int(size.height),
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
    )
    context?.draw(self, in: CGRect(origin: .zero, size: size))
    CVPixelBufferUnlockBaseAddress(buffer, [])
    return buffer
  }
}
