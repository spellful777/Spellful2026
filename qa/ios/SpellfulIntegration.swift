import XCTest
import UIKit
import WebKit

@MainActor
final class SpellfulIntegration: XCTestCase {
    private func webView(in view: UIView) -> WKWebView? {
        if let browser = view as? WKWebView { return browser }
        for child in view.subviews {
            if let browser = webView(in: child) { return browser }
        }
        return nil
    }

    func testAuthenticatedMessaging() async throws {
        let fixtures = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "accounts", withExtension: "json"))
        let accounts = try JSONSerialization.jsonObject(with: Data(contentsOf: fixtures))
        let script = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "messaging", withExtension: "js"))
        let window = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first)
        let web = try XCTUnwrap(webView(in: window))
        for _ in 0..<120 {
            if let ready = try? await web.evaluateJavaScript("Boolean(document.querySelector('#app')?.childElementCount && window.Capacitor?.isNativePlatform())") as? Bool, ready { break }
            try await Task.sleep(nanoseconds: 500_000_000)
        }
        let result = try await web.callAsyncJavaScript(String(contentsOf: script, encoding: .utf8), arguments: ["accounts": accounts], in: nil, contentWorld: .page)
        XCTAssertEqual(result as? String, "passed")
    }
}
