#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FaceDetectorModule, NSObject)

RCT_EXTERN_METHOD(detect:(NSString *)uri
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
