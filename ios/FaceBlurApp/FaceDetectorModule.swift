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

      let results = request.results as? [VNFaceObservation] ?? []
      let imageWidth = Double(cgImage.width)
      let imageHeight = Double(cgImage.height)

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

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
      try handler.perform([request])
    } catch {
      reject("DETECTION_FAILED", error.localizedDescription, error)
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool { false }
}
