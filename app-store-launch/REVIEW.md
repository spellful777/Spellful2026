# Spellful App Store update review

The public GitHub review branch uses the contents of the attached Spellful-AppStore-Update archive. The repository default branch did not contain that folder when inspected. Both handoff instruction files were reviewed before integration.

## App and artwork

The project uses Vite/React, an Express server and Capacitor with an Xcode iPhone/iPad target. The existing AppIcon catalog already points to one 1024 × 1024 universal iOS PNG. Its new contents are byte-identical to the approved opaque RGB icon. The approved artwork has rounded artwork and black corners baked in. Review the Home Screen mask on a device before approving any full-bleed redesign.

The native launch screen now displays the supplied transparent wordmark on a dark background. The white wordmark slot used on dark surfaces points to the new master. The existing black wordmark remains available for light surfaces. The web app has exact-size 192 and 512 px install icons, a 180 px Apple touch icon, a 32 px web favicon, a multi-size ICO, and matching install prompts and notification graphics. Maskable cropping is not advertised for this artwork. No database, authentication, purchase, messaging or user-data code changed. The bundle identifier, deployment targets and version/build settings remain com.spellful.app and 1.0 (project build 1).

All 29 handoff images passed decoding and path, format, color mode, byte-size and dimension checks against the supplied manifest. The artwork selection in review-assets.json uses the 5244 × 2950 header PNG and **1920 × 1280 search JPEG**. The alternate PNG and prior rejected large search PNG are reference material. The portal's acceptance of the retry is unverified. Banner, wallpaper, wordmark and original icon are preserved. The 18 screenshot layouts follow the same sequence at 1206 × 2622, 1320 × 2868 and 2064 × 2752: daily magic, tarot, grimoire, rituals, calendar and community. Dimensions match Apple's published size tables. The six designs came from the web. The tablet layouts do not establish native iPad behavior. Replace those with native captures taken with a demo account, remove personal names and dated horoscope data, and review promotional mockups before external use.

The 24 review-only assets are outside the web bundle and ignored by Git. Their **exact paths and SHA-256 digests** are in [review-assets.json](review-assets.json). To restore them from the handoff ZIP into the release folder, run `python3 app-store-launch/restore-review-artwork.py /path/to/Spellful-AppStore-Update.zip`. The importer verified all 24 locally, restored all 24 into an empty test directory and preserves existing differing files.

## Listing and organic search

Read-only App Store Connect checks found the existing Spellful app under com.spellful.app. Its U.S. name is **Spellful**, the subtitle is empty, and version 1.0 is in Prepare for Submission. Apple returned zero builds and zero subscription groups. The repository listing uses that confirmed identity and the handoff's **one** fallback keyword field. Promotional copy and the description include natural astrology, tarot, moon and grimoire terms. The description retains the existing monthly subscription disclosure.

| Field | Active draft | Limit |
| --- | ---: | ---: |
| App name | 8 characters | 30 |
| Subtitle | 0 characters | 30 |
| Keywords | 96 UTF-8 bytes | 100 |
| Promotional text | 141 characters | 170 |
| Description with subscription disclosure | 1,903 characters | 4,000 |

The proposed name **Spellful: Astrology & Tarot** and subtitle **Daily Horoscope & Birth Chart** are preserved in the original handoff. Confirm name availability with Apple and approve both before switching to the alternative 93-byte keyword set. Lifestyle and Reference are draft category selections. Confirm the legal copyright owner, category choices, localized pricing, privacy disclosures, age rating and export-compliance answers. The repository support page includes a support email at /about#support. The live About HTML retrieved during review did not confirm that contact section; verify it after deploying the support page. Confirm the public privacy URL, review account and moderation contact. Organic search placement and featuring depend on Apple.

## Validation and release gates

- Production client and server builds passed. Capacitor copied the updated bundle and synced the iOS plugins. The two manifest icons decode at their declared sizes in the native web bundle. The Apple touch link and wordmark resolve to bundled files.
- TypeScript passed. ESLint completed with zero errors and 209 warnings. Vitest reported 345 passed, 2 failed and 8 skipped. The two editor-parity tests lack the original media-slot-preview and text-size modules; the seed suite lacks scripts/seed.ts. These match the pre-update baseline.
- The pull request requests Xcode Release compilation, install and launch on an iPhone simulator. Its GitHub check records the result separately. Device signing, TestFlight, storefront approval and actual device screenshots require separate evidence.
- Complete subscription setup for com.spellful.plus.monthly, including sandbox purchase and restoration, Apple signing and upload, and App Review materials before submission. No Apple metadata mutation, asset upload, store submission or deployment was performed for this review.

Apple references: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), [platform version fields](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/) and [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

## Changed repository files

- `.github/workflows/ios-simulator.yml`
- `airo-media.json`
- `app-store-launch/.gitignore`
- `app-store-launch/README.md`
- `app-store-launch/REVIEW.md`
- `app-store-launch/WORK-INSTRUCTIONS.md`
- `app-store-launch/asset-manifest.json`
- `app-store-launch/assets/app-icon-1024.png`
- `app-store-launch/assets/brand-and-screenshots/banner-landscape.png`
- `app-store-launch/assets/brand-and-screenshots/logo-transparent.png`
- `app-store-launch/assets/brand-and-screenshots/wallpaper-portrait.png`
- `app-store-launch/assets/icon-approved-original.png`
- `app-store-launch/metadata/en-US.json`
- `app-store-launch/metadata/listing-copy.md`
- `app-store-launch/restore-review-artwork.py`
- `app-store-launch/review-assets.json`
- `index.html`
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png`
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png`
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png`
- `public/airo-media.json`
- `public/assets/media/spellful-icon-180.png`
- `public/assets/media/spellful-icon-192.png`
- `public/assets/media/spellful-icon-32.png`
- `public/assets/media/spellful-icon-512.png`
- `public/assets/media/spellful-wordmark.png`
- `public/favicon.ico`
- `public/manifest.json`
- `public/sw.js`
- `src/components/InstallSpellful.tsx`
- `src/content/pages/app_store_screenshots.json`
- `src/content/pages/app_store_submission.json`
- `src/pages/app-store-screenshots.tsx`
- `src/pages/app-store-submission.tsx`
