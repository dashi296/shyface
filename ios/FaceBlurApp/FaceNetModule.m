#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FaceNetModule, NSObject)

RCT_EXTERN_METHOD(extractEmbedding:(NSString *)uri
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(extractAll:(NSArray<NSString *> *)uris
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
