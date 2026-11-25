# Spellful iOS release readiness

Updated November 25, 2026. The release is awaiting Apple signing, end-to-end subscription verification, and submission review. The app uses bundle ID `com.spellful.app`, version 1.0 and the monthly product `com.spellful.plus.monthly`.

## Build and test evidence

| Check | Evidence |
| --- | --- |
| Source | Recovered Spellful 7.zip, SHA-256 `129cffa7c0085a5c6a70df48d1315fda23c86e1526248feef13133d35a6f1497`. Source and assets are in this repository. |
| Production client, server and native resources | Vite built the client and server. Capacitor copied the web bundle into the iOS app and synced the native Share and Native Purchases plugins. TypeScript passed. ESLint reported zero errors and 209 warnings. The production dependency audit reported zero known vulnerabilities at the time of testing. |
| Native release build | [macOS build evidence](https://github.com/spellful777/Spellful2026/actions/runs/45557405620). Xcode compiled the Release configuration, installed it on an iPhone simulator and launched it. The [subsequent run](https://github.com/spellful777/Spellful2026/actions/runs/45559446891) also packaged an unsigned simulator app as a downloadable artifact. |
| Messaging and auth | Two dedicated users completed email verification and password sign-in. Each participant sent and decrypted an encrypted message. Retrying a send preserved its ID. Editing, reacting, pinning, soft-deleting a message, and deleting the conversation from both inboxes passed against the published API. |
| Live API coverage | Thirteen reads returned HTTP 200 and JSON. Covered verified session, health, profile, privacy settings, sessions, Plus entitlement, conversations, reminders, spells, herbs, community categories, Academy progress, and moon rituals. The live server's deployed revision is unknown. |
| Mobile-size navigation | Chromium rendered the current bundled client at 390 × 844 with live API reads and a QA session. Home, tarot, herbs, runes, Academy, birth chart, moon calendar, Plus, privacy, terms, dashboard, messages and security each rendered its expected heading with no uncaught page exception. A separate interactive run shuffled the tarot deck, drew and revealed cards, cast and revealed runes, and opened the support email link target. |
| Automated tests | Vitest reported 344 passed, 2 failed and 8 skipped. Two editor parity tests require source modules omitted from the original export. Eight seed checks could not start because the export omitted scripts/seed.ts. Restore the original authoring modules and seed utility to verify parity. |
| Native messaging and purchases | [Native integration run](https://github.com/spellful777/Spellful2026/actions/runs/45627771136). Separate hosted XTests exercise the WebView with verified users and the real StoreKit bridge using an Xcode-local monthly product. A TestFlight purchase against Apple's sandbox and a reinstall/restore remain required. |

## App Store review preparation

- The paywall retrieves the local StoreKit price, exposes restoration, and links to terms and privacy. Confirm the subscription group, product, price, localization, review screenshot and availability in App Store Connect.
- The release settings include an in-use location purpose for the optional sky chart. Review the signed archive's complete privacy report, including Capacitor and third-party SDK declarations. Verify actual location and image-picker behavior on a device.
- The app handles account details, optional birth and location details, journals, community content, messages and purchases. Confirm actual retention, server analytics, advertising settings and third-party sharing before filing the App Privacy answers. The repository includes optional advertising support. The app's use of ECDH and AES-GCM requires an export-compliance determination from the account holder.
- Account settings expose password-confirmed deletion with a 30-day cancellation period, and the server includes a scheduled purge. Verify an aged fixture against a nonproduction deployment before attesting to full deletion. Community reporting, blocking and moderation require a staffed response process and review credentials.
- The listing draft includes the optional subscription and support contact. Verify the deployed support URL, privacy URL and public support mailbox. Complete the age questionnaire for social and user-generated content, supply real device screenshots at the required dimensions, and provide App Review with a durable working account privately.
- Apple guidance: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and [App privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## Signing and distribution

The manual [TestFlight workflow](.github/workflows/testflight.yml) runs only from main. It needs an unused Apple build number and signing/provisioning access through the repository's testflight environment. Configure ASC_TEAM_ID, ASC_KEY_ID, ASC_ISSUER_ID and ASC_PRIVATE_KEY as secrets. Never put private keys or review credentials in this repository.

Deploy the signed-transaction verifier with the correct numeric APPLE_APP_ID. For TestFlight testing, point VITE_IOS_API_ORIGIN to an authorized HTTPS backend with APPLE_STORE_ENVIRONMENT=Sandbox and isolated subscription data. Verify purchase, restore, renewal, cancellation, expiration, refunds and server notifications against that deployment. Code in GitHub does not establish what is running on the published backend.

No signed device IPA, TestFlight build number or upload receipt has been verified. A successful simulator build is installable only on a simulator. Public App Store release requires the owner's separate approval.
