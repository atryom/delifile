import Foundation
import React

// Exposes the same NativeModules.ShareIntent interface as the Android module.
// Data is passed via App Group UserDefaults keyed "sharedData".
@objc(ShareIntent)
class ShareIntent: NSObject {

    private let appGroupId = "group.com.delifile.app"

    @objc func getSharedData(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let defaults = UserDefaults(suiteName: appGroupId)
        resolve(defaults?.dictionary(forKey: "sharedData"))
    }

    @objc func clearSharedData(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let defaults = UserDefaults(suiteName: appGroupId)
        defaults?.removeObject(forKey: "sharedData")
        defaults?.synchronize()

        // Also clean up any copied file left in the App Group container
        if let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) {
            let contents = (try? FileManager.default.contentsOfDirectory(
                at: container, includingPropertiesForKeys: nil
            )) ?? []
            for url in contents where !url.lastPathComponent.hasPrefix(".") {
                try? FileManager.default.removeItem(at: url)
            }
        }

        resolve(nil)
    }

    @objc static func requiresMainQueueSetup() -> Bool { false }
}
