import Foundation
import Vision
import UIKit

@objc(FaceDetectorModule)
class FaceDetectorModule: NSObject {

  @objc
  func detect(_ uri: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let url = URL(string: uri), let image = UIImage(contentsOfFile: url.path), let cgImage = image.cgImage else {
      reject("INVALID_URI", "Cannot load image from URI: \(uri)", nil)
      return
    }

    let request = VNDetectFaceRectanglesRequest { request, error in
      if let error = error {
        reject("DETECTION_FAILED", error.localizedDescription, error)
        return
      }

      let allResults = request.results as? [VNFaceObservation] ?? []
      // confidence が閾値未満の検出結果を除外する（shared/config/constants.ts の FACE_DETECTION_CONFIDENCE_THRESHOLD と同値）
      let results = allResults.filter { $0.confidence >= 0.5 }
      // image.size は EXIF 回転後の表示サイズ。cgImage.width/height は生ピクセルなので使わない
      let imageWidth = Double(image.size.width)
      let imageHeight = Double(image.size.height)

      let boxes = results.map { face -> [String: Double] in
        let boundingBox = face.boundingBox
        return [
          "x": boundingBox.origin.x * imageWidth,
          "y": (1 - boundingBox.origin.y - boundingBox.height) * imageHeight,
          "width": boundingBox.width * imageWidth,
          "height": boundingBox.height * imageHeight,
        ]
      }

      resolve(boxes)
    }

    // EXIF 回転情報を Vision に伝えることで、縦撮り写真でも正しい座標を返す
    let orientation = CGImagePropertyOrientation(image.imageOrientation)
    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
    do {
      try handler.perform([request])
    } catch {
      reject("DETECTION_FAILED", error.localizedDescription, error)
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool { false }
}

private extension CGImagePropertyOrientation {
  init(_ uiOrientation: UIImage.Orientation) {
    switch uiOrientation {
    case .up:            self = .up
    case .down:          self = .down
    case .left:          self = .left
    case .right:         self = .right
    case .upMirrored:    self = .upMirrored
    case .downMirrored:  self = .downMirrored
    case .leftMirrored:  self = .leftMirrored
    case .rightMirrored: self = .rightMirrored
    @unknown default:    self = .up
    }
  }
}
