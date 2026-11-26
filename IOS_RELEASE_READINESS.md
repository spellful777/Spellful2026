# Spellful iOS release readiness

Updated November 25, 2026. The release is awaiting Apple signing, end-to-end subscription verification, and submission review. The app uses bundle ID `com.spellful.app`, version 1.0 and the monthly product `com.spellful.plus.monthly`.

## Build and test evidence

| Check | Evidence |
| --- | --- |
| Source | Integrated the Spellful 8 ZIP from Drive, SHA-256 `188b80bb1f5a9f364fc78150fd78a6ca04a23538b185a7cb9ebeb54ef2f9b6bd`. Compared to Spellful 7, 196 files were new or changed. [Full release diff](https://github.com/spellful777/Spellful2026/pull/2/files). |
| Production build | Vite built the client and server. Capacitor copied the bundled app and synced Share and Native Purchases. TypeScript passed. ESLint reported zero errors and 217 warnings. npm reported zero known production dependency vulnerabilities. |
| Brand and media | All 49 changed images decoded and matched the files copied into the iOS bundle byte for byte. The iOS icon is 1024 × 1024 RGB. The installed web manifest resolves to 192 × 192 and 512 × 512 icons of those dimensions. See the [artwork and listing review](app-store-launch/REVIEW.md) for the metadata lengths and artwork restrictions. |
| Messaging | Two dedicated, verified test accounts used independent Chromium contexts with the rebuilt client and the deployed API. Both entered, sent and decrypted a private message. The synthetic conversation was deleted afterward. The composer, 16 px input and Send button fit at 320 × 568, 390 × 844 and 667 × 375, including a long unbroken message. Physical keyboard and safe-area checks require an iPhone. |
| Navigation and flows | The mobile browser rendered headings on 20 routes without an uncaught page exception, including Plus, messaging, security, discovery, community help and bookmarks. Tarot draw/reveal, rune cast/reveal and the support contact link passed. These tests used the deployed API. Its source revision is unverified. |
| Automated tests | Vitest reported 345 passed, two failed and eight skipped, with one suite failing during collection. The missing original files are `export-plugins/utils/media-slot-preview`, `export-plugins/utils/text-size` and `scripts/seed.ts`. |
| Native simulator | Both November 25 retries compiled, installed and launched the Release build. The [signed-in run](https://github.com/spellful777/Spellful2026/actions/runs/45757646201) ended during account provisioning. The [StoreKit run](https://github.com/spellful777/Spellful2026/actions/runs/45757637299) was cancelled during XCTest setup. The [Apple silicon retry](https://github.com/spellful777/Spellful2026/actions/runs/45765497660) compiled and launched the app. Account provisioning and the StoreKit test step failed. Native sign-in and messaging, StoreKit purchase and restoration still need passing results. |

## App Store review preparation

- The paywall retrieves the local StoreKit price, exposes restoration, and links to terms and privacy. Confirm the subscription group, product, price, localization, review screenshot and availability in App Store Connect.
- The release settings include an in-use location purpose for the optional sky chart. Review the signed archive's complete privacy report, including Capacitor and third-party SDK declarations. Verify actual location and image-picker behavior on a device.
- The app handles account details, optional birth and location details, journals, community content, messages and purchases. Confirm actual retention, server analytics, advertising settings and third-party sharing before filing the App Privacy answers. The repository includes optional advertising support. The app's use of ECDH and AES-GCM requires an export-compliance determination from the account holder.
- Account settings expose password-confirmed deletion with a 30-day cancellation period, and the server includes a scheduled purge. Verify an aged fixture against a nonproduction deployment before attesting to full deletion. Community reporting, blocking and moderation require a staffed response process and review credentials.
- The listing draft includes the optional subscription and support contact. Verify the deployed support URL, privacy URL and public support mailbox. Complete the age questionnaire for social and user-generated content, supply real device screenshots at the required dimensions, and provide App Review with a durable working account privately.
- Apple guidance: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and [App privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## Signing and distribution

The [TestFlight workflow](.github/workflows/testflight.yml) uses an Apple Distribution certificate and matching App Store Connect provisioning profile. The [build 1 run](https://github.com/spellful777/Spellful2026/actions/runs/45766625211/attempts/2) signed and exported version 1.0 and uploaded it successfully. Apple reported that the package was processing on November 25, 2026 Phoenix time.

Deploy the signed-transaction verifier with the correct numeric APPLE_APP_ID. For TestFlight testing, point VITE_IOS_API_ORIGIN to an authorized HTTPS backend with APPLE_STORE_ENVIRONMENT=Sandbox and isolated subscription data. Verify purchase, restore, renewal, cancellation, expiration, refunds and server notifications against that deployment. Code in GitHub does not establish what is running on the published backend.

App Store Connect recognizes Spellful and `com.spellful.app`. Version 1.0 is in Prepare for Submission. The API returned no builds, subscription groups or visible signing certificates. Use the existing app record. Confirm the signing team and secure workflow configuration in the [GitHub environment settings](https://github.com/spellful777/Spellful2026/settings/environments).

Build 1 cleared export compliance, was added to the Spellful Internal QA group, and was installed by the account holder. The tester reported email sign-in and sign-up failures, sharing issues and status-bar overlap. [Build 2](https://github.com/spellful777/Spellful2026/actions/runs/45795789130) routes iOS email auth through the native HTTP bridge, corrects affected public share URLs and uses a viewport contained within the iOS safe area. The production client and server builds, Capacitor sync, TypeScript and two targeted regression tests passed. Verify all four reported behaviors using the signed TestFlight build before expanding testing. Public App Store release requires the owner's separate approval.
