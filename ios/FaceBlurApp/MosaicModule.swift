import Foundation

// Mosaic processing is handled by Skia on the JS side.
// This module is a placeholder for future native migration.
@objc(MosaicModule)
class MosaicModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }
}
