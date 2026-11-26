import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SpellfulRootViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// WKWebView viewport metadata does not move the native view away from the
// status bar. Constrain the bridge itself to the window's safe area.
private final class SpellfulRootViewController: UIViewController {
    private let bridgeController = CAPBridgeViewController()

    override var childForStatusBarStyle: UIViewController? { bridgeController }
    override var childForStatusBarHidden: UIViewController? { bridgeController }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 14/255, green: 13/255, blue: 26/255, alpha: 1)
        addChild(bridgeController)
        let bridgeView = bridgeController.view!
        bridgeView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bridgeView)
        let safeArea = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            bridgeView.topAnchor.constraint(equalTo: safeArea.topAnchor),
            bridgeView.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor),
            bridgeView.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor),
            bridgeView.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor),
        ])
        bridgeController.didMove(toParent: self)
    }
}
