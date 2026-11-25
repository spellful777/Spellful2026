import XCTest
import StoreKitTest
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

    private func appWebView() async throws -> WKWebView {
        let window = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first)
        let web = try XCTUnwrap(webView(in: window))
        for _ in 0..<120 {
            if let ready = try? await web.evaluateJavaScript("Boolean(document.querySelector('#app')?.childElementCount && window.Capacitor?.isNativePlatform())") as? Bool, ready { break }
            try await Task.sleep(nanoseconds: 500_000_000)
        }
        return web
    }

    func testMonthlyPurchaseAndRestoreInXcode() async throws {
        let resource = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "Spellful", withExtension: "storekit"))
        let store = try SKTestSession(contentsOf: resource)
        store.resetToDefaultState()
        store.disableDialogs = true
        store.clearTransactions()
        defer { store.clearTransactions() }
        let web = try await appWebView()
        let script = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "purchases", withExtension: "js"))
        let result = try await web.callAsyncJavaScript(String(contentsOf: script, encoding: .utf8), arguments: [:], in: nil, contentWorld: .page)
        XCTAssertEqual(result as? String, "passed")
    }

    func testAuthenticatedMessaging() async throws {
        let fixtures = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "accounts", withExtension: "json"))
        let accounts = try JSONSerialization.jsonObject(with: Data(contentsOf: fixtures))
        let script = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "messaging", withExtension: "js"))
        let web = try await appWebView()
        let result = try await web.callAsyncJavaScript(String(contentsOf: script, encoding: .utf8), arguments: ["accounts": accounts], in: nil, contentWorld: .page)
        XCTAssertEqual(result as? String, "passed")
    }
}
