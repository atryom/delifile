import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    private let appGroupId = "group.com.delifile.app"
    private let appScheme  = "delifile://share"

    private let spinner = UIActivityIndicatorView(style: .large)
    private let messageLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.8)

        spinner.color = UIColor(red: 0.15, green: 0.39, blue: 0.92, alpha: 1)
        spinner.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(spinner)

        messageLabel.translatesAutoresizingMaskIntoConstraints = false
        messageLabel.text = "Подготовка..."
        messageLabel.textColor = .secondaryLabel
        messageLabel.font = .systemFont(ofSize: 15)
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0
        view.addSubview(messageLabel)

        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -20),

            messageLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 16),
            messageLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            messageLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
        ])
        spinner.startAnimating()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        handleSharedContent()
    }

    // MARK: – Main dispatch

    private func handleSharedContent() {
        guard
            let items = extensionContext?.inputItems as? [NSExtensionItem],
            let item  = items.first,
            let attachments = item.attachments,
            !attachments.isEmpty
        else { cancel(); return }

        let provider = attachments[0]

        // 1. File from Files app (public.file-url).
        // Must be checked BEFORE public.url because public.file-url conforms to public.url,
        // so a file shared from Files app would otherwise be loaded as a URL string
        // (file:///private/var/...) and mistakenly treated as plain text.
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            // Skip URL/text type identifiers; take the first content-type UTI for the file.
            let contentUTI = provider.registeredTypeIdentifiers.first(where: {
                $0 != UTType.fileURL.identifier && $0 != UTType.url.identifier && $0 != UTType.plainText.identifier
            }) ?? UTType.data.identifier
            provider.loadFileRepresentation(forTypeIdentifier: contentUTI) { [weak self] url, _ in
                guard let self = self else { return }
                if let url = url {
                    self.handleFile(tempURL: url, provider: provider)
                } else {
                    DispatchQueue.main.async { self.cancel() }
                }
            }
            return
        }

        // 2. Web URL (shared from Safari / Chrome)
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] data, _ in
                DispatchQueue.main.async {
                    if let url = data as? URL {
                        self?.save(type: "text", text: url.absoluteString, uri: nil, name: nil, mimeType: nil)
                    } else {
                        self?.cancel()
                    }
                }
            }
            return
        }

        // 3. Plain text (may contain a URL)
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { [weak self] data, _ in
                DispatchQueue.main.async {
                    if let text = data as? String {
                        self?.save(type: "text", text: text, uri: nil, name: nil, mimeType: nil)
                    } else {
                        self?.cancel()
                    }
                }
            }
            return
        }

        // 4. File / binary data (catch-all)
        let fileUTI = provider.registeredTypeIdentifiers.first ?? UTType.data.identifier
        provider.loadFileRepresentation(forTypeIdentifier: fileUTI) { [weak self] url, _ in
            guard let self = self else { return }
            if let url = url {
                self.handleFile(tempURL: url, provider: provider)
            } else {
                DispatchQueue.main.async { self.cancel() }
            }
        }
    }

    // MARK: – File handling

    private func handleFile(tempURL: URL, provider: NSItemProvider) {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else {
            DispatchQueue.main.async { self.cancel() }
            return
        }

        let fileName = tempURL.lastPathComponent
        let destURL  = container.appendingPathComponent(fileName)

        do {
            if FileManager.default.fileExists(atPath: destURL.path) {
                try FileManager.default.removeItem(at: destURL)
            }
            try FileManager.default.copyItem(at: tempURL, to: destURL)
            NSLog("[ShareExtension] copied shared file to App Group container: \(fileName)")
        } catch {
            NSLog("[ShareExtension] failed to copy shared file: \(error.localizedDescription)")
            DispatchQueue.main.async { self.cancel() }
            return
        }

        // Determine MIME type
        var mimeType = "application/octet-stream"
        if let uti = UTType(provider.registeredTypeIdentifiers.first ?? "") {
            mimeType = uti.preferredMIMEType ?? mimeType
        }

        DispatchQueue.main.async {
            self.save(type: "file", text: nil, uri: destURL.absoluteString, name: fileName, mimeType: mimeType)
        }
    }

    // MARK: – Persist & open

    private func save(type: String, text: String?, uri: String?, name: String?, mimeType: String?) {
        var data: [String: String] = ["type": type]
        if let t = text     { data["text"] = t }
        if let u = uri      { data["uri"] = u }
        if let n = name     { data["name"] = n }
        if let m = mimeType { data["mimeType"] = m }
        // Also mirror fileName key used by Android
        if let n = name     { data["fileName"] = n }

        let defaults = UserDefaults(suiteName: appGroupId)
        defaults?.set(data, forKey: "sharedData")
        defaults?.synchronize()
        NSLog("[ShareExtension] sharedData written (type=\(type))")

        openMainApp()
    }

    private func openMainApp() {
        guard let url = URL(string: appScheme) else { complete(); return }

        messageLabel.text = "Открываем DeliFile..."

        // CRITICAL ORDER: open the host app BEFORE completing the request.
        //
        // extensionContext.completeRequest(...) tears the extension's view controller
        // off the window. Once detached, the responder chain no longer reaches the
        // extension process's UIApplication, so any openURL attempt fails — and the
        // user sees the extension flicker open/closed without the app launching.
        //
        // While this VC is still on screen, the responder chain
        // (self → view → window → UIWindowScene → UIApplication) does reach a live
        // UIApplication instance. We grab it and call the modern
        // open(_:options:completionHandler:) — the deprecated `openURL:` selector is a
        // silent no-op on iOS 17/18. We only complete() (dismiss) once the open call
        // reports back, so there is no flicker: the main app is already in the
        // foreground by the time the extension closes behind it.
        if let application = findHostApplication() {
            application.open(url, options: [:]) { [weak self] success in
                self?.finishOpen(success: success)
            }
            return
        }

        // Fallback: no UIApplication reachable via the responder chain — try the
        // extension context API (works for some iOS versions / host apps).
        extensionContext?.open(url) { [weak self] success in
            self?.finishOpen(success: success)
        }
    }

    /// Walks the responder chain to find the extension process's live UIApplication.
    /// UIApplication.shared is unavailable in app extensions, but the running instance
    /// is reachable through the responder chain while the VC is attached to the window.
    private func findHostApplication() -> UIApplication? {
        var responder: UIResponder? = self
        while let current = responder {
            if let application = current as? UIApplication { return application }
            responder = current.next
        }
        return nil
    }

    /// Dismisses the extension on success; otherwise shows a brief instruction so the
    /// user knows to open the app manually (data is already saved to the App Group and
    /// will be picked up on the next foreground via checkIntent()).
    private func finishOpen(success: Bool) {
        if success {
            NSLog("[ShareExtension] main app opened")
            complete()
        } else {
            NSLog("[ShareExtension] failed to open main app — instructing user")
            messageLabel.text = "Файл получен.\nОткройте DeliFile, чтобы завершить загрузку."
            spinner.stopAnimating()
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                self?.complete()
            }
        }
    }

    private func complete() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func cancel() {
        extensionContext?.cancelRequest(
            withError: NSError(domain: "com.delifile.ShareExtension", code: -1,
                               userInfo: [NSLocalizedDescriptionKey: "No supported content"])
        )
    }
}
