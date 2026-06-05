#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ShareIntent, NSObject)

RCT_EXTERN_METHOD(
    getSharedData:(RCTPromiseResolveBlock)resolve
    rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    clearSharedData:(RCTPromiseResolveBlock)resolve
    rejecter:(RCTPromiseRejectBlock)reject
)

@end
