# Spellful — App Store launch handoff

Prepared 2026-11-25. Latest centered purple/gold icon supersedes earlier icons. This is an asset and metadata package, not an app build.

## Use with ChatGPT Work
Upload the extracted folder to your repository (suggested location `app-store-launch/`), preferably on a feature branch. Ask Work to read `WORK-INSTRUCTIONS.md` and inspect the existing app before changing anything. No repository was modified by this package.

## Asset selection
- `assets/app-icon-1024.png`: latest approved icon, resized to 1024 x 1024 RGB, no alpha. Original preserved beside it. The approved illustration contains baked-in rounded edges and black corners; for Apple production icon, review whether to extend artwork to full square before applying system mask. Do not silently redesign it.
- `assets/Spellful_Header_5244x2950.png`: header candidate.
- `assets/Spellful_Search_1920x1280.jpg`: preferred retry for search results; PNG alternative included. Larger search PNG retained for reference only (previous upload rejected).
- `assets/brand-and-screenshots/`: brand board, transparent logo, wallpaper, marketing banner, preview and six screenshots per size (1206x2622, 1320x2868, 2064x2752).
- `metadata/en-US.json`: listing copy and proposed settings; `listing-copy.md` is the human-readable version.
- `asset-manifest.json`: measured dimensions and file properties, not proof of App Store acceptance.

## Review before publishing
Header/search artwork contains generated mockups; screenshot layouts came from website captures, not verified native builds. Some artwork contains a personal display name and dated horoscope information; use a demo account and check privacy before publishing publicly. iPad layouts are not actual iPad captures. Verify all features and metadata against the submitted app. Previous search upload reported invalid dimensions; acceptance of retry is unconfirmed. Verify support URL has contact information, legal copyright owner, app version, category and icon requirements. Palette approximated from screenshots: #0F0E1B, #1C172F, #C9A64B, #A99BC3, #F6F3F8. No live CSS verification. Organic rankings cannot be guaranteed. No competitor names in store metadata. App Clip, routing and iMessage fields only if applicable.
