# Spellful Social V2 audit and roadmap

Baseline: GitHub `main` at `cda06213f6c8674afe81a0bd9a84f5947ae8ef5e`. The repository tree contains 1,238 entries. This audit combines the complete tree inventory with inspection of representative implementation and configuration. Production database contents, provider configuration and the signed iOS app were outside the inspected baseline.

## Existing platform

| Area | Repository evidence | Development decision |
| --- | --- | --- |
| Web, design and iOS | React, Vite, TypeScript, React Router, Tailwind and shadcn/ui. Client and SSR bundles, app layouts and shared brand components. Capacitor Xcode project and iOS plugins. | Extend existing routes and visual tokens. Verify keyboard, touch, VoiceOver, screen readers and reduced motion in staging. |
| Coven | Community forums, Hearth, timeline, follows, accepted Coven connections, tags, discovery, text/image posts, polls, threaded replies, likes, bookmarks, notifications and Grimoire references. Circles and creator applications are separate systems. | Reuse existing identities and records. Audit which groups and creator workflows support community membership, events and practitioner verification before extending them. |
| Privacy and messaging | Better Auth with Drizzle/MySQL, email OTP, OAuth and two-factor code. Profile privacy, bio, interests, Big Three, blocking, conversation requests, encrypted message payloads, push, sessions, account export and deletion endpoints. | Keep account and message identities intact. Exercise a permission matrix across discovery, detail, engagement, notifications, sharing, moderation and export. |
| Moderation | Report endpoints and admin roles, dashboards, community moderation, audit, engagement and application screens. | Verify filtering, moderator escalation, response workflow, support contact and review access. Apple App Review Guideline 1.2 covers filtering, reporting and timely response, blocking and published contact information. |
| Subscriptions | Plus entitlement and StoreKit transaction verification code, Apple root certificate, native purchase bridge and account management. | Preserve entitlement records and API contracts. Validate purchase, restore, refund and notifications using isolated sandbox data. Follow IOS_RELEASE_READINESS.md for the independently managed release. |
| Spiritual systems | Sanctuary, Grimoire, encrypted Dream Journal, Academy, Moon Calendar, rituals, spells, herbs, tarot, runes, numerology, chart and compatibility pages. | Reuse existing tools and place related content links at the point of use. Treat journal publication as an explicit new projection. |
| Astronomy | Custom astrology and moon engines, Aspect tools, synastry, solar return modal, Live Sky and celestial time machine. Custom calculations include approximations, such as simplified house cusps and Hearth's mean lunation. | Benchmark against a reference ephemeris before representing event times as live. Keep traditional zodiac and timing conventions labeled. Preserve compatibility with saved readings. |
| Sharing | Existing deep links, in-conversation references, Share Studio and client-generated imagery. | Add explicit server-side share records and sanitized projections. Keep private source objects behind authorization. |
| Persistence and deployment | MySQL2 pool, Drizzle schema, task-local Nomad config, startup DDL, email gateway, Vite SSR. GitHub contains iOS simulator and manual TestFlight workflows. | Verify web runtime and restore on the actual host before moving traffic. Separate staging database, variables and scheduled work from production. |

## Airo migration

Standalone dependencies install and the client build runs in CI without the builder. The export retains package aliases and local adapters for content, format overrides and media. Database configuration reads a Nomad task-local JSON file. Server email expects a loopback gateway, and the standalone Airo secrets adapter uses environment variables. Generated content and media manifests are inputs to the build.

Keep the exported content, styling and media during migration. Replace deployment contracts individually after staging confirms MySQL connectivity with certificate verification, credentials loading, delivery of verification and recovery emails, SSR and media behavior. Retire the builder only after parity and a rollback drill. Audit runtime behavior of provider integrations during that drill.

## GoDaddy Enhance verification

GoDaddy publishes 4 accessible CPU cores, 8 GB RAM and 200 GB disk for eligible Enhance plans. The account quota is pending verification. GoDaddy's current Node hosting page advertises Node 22, Express and GitHub connection. The GoDaddy component matrix lists MySQL and cron for cPanel. Confirm product availability on the existing Enhance account and verify the node version, startup command, health check, process persistence/restarts, proxy settings, environment injection, MySQL TLS, cron invocation, WebSocket upgrade and file persistence across deploys.

The GoDaddy screenshots confirm a healthy deployment from `spellful777/Spellful2026` on `main`, using Node.js 22 in North America. The dashboard has separate Update Preview and Publish to Live actions. It does not establish whether Preview can track a separate branch or uses isolated data, or whether GitHub pushes trigger updates automatically. Use a separate staging target for the feature branch once database, secrets and scheduler isolation are confirmed. GitHub reported `main` as unprotected. GitHub's TestFlight workflow requires manual dispatch and permits upload only from `main`. The simulator runs on relevant pushes to `main` or when manually dispatched.

Use one Express process and MySQL to start. Measure memory and query latency before adding infrastructure. Plan for existing MySQL and transactional email, plus durable media storage if staging tests show that the host's filesystem does not meet requirements. A polling feed works with ordinary HTTPS. Validate cron and scheduler deduplication before enabling generated posts.

## Task tracker

| Phase | Status | Tasks and acceptance |
| --- | --- | --- |
| 1. Audit | Started | Development branch created. Confirm protection settings, preview isolation, infrastructure limits, integration inventory and isolated restore. |
| 2. Coven | Started | Add follow-first and chronological views with deterministic ordering and access predicates. Extend policy to all post interactions. Move high-volume feeds to cursor pagination after inspecting query plans. Add indexes from measured queries. Ship mentions, reposts, quote posts, multimedia, group membership and events, richer reactions and verification with moderation. |
| 3. Living Posts | Pending | Version discriminated schemas for astrology chart types, tarot, oracle, pick-a-card, ritual, spell, numerology, lunar events and opted-in excerpts. Implement chart indicators and interpretations, card reveals, ritual checklist and Grimoire saves. Keep body and schema rendering text-safe. |
| 4. Cosmic Pulse | Started | Cached positions, lunar phase angle, quarters and eclipse maxima on Coven. Extend to global navigation, ingresses, exact aspects, stations and shadows, void-of-course, planetary hours, countdowns and personalized transits. Assert reference tolerances. Use a unique event key for repeat-safe posting and link relevant Spellful content. |
| 5. Spellful Share | Pending | Create public, unlisted and owner-only records with revocation, optional expiry, attribution, interactive pages and redacted Open Graph previews. Confirm denial and cache invalidation after revocation. |
| 6. Astrology | Pending | Inventory implementations and accuracy. Plan progressions, solar arcs, returns, synastry/composite/Davison, astrocartography/relocation, draconic/harmonics, profections and releasing, dignities/lots/stars/asteroids, dispositors, ephemeris, electional timing and patterns around shared calculations. |
| 7. Ecosystem | Pending | Connect Sanctuary, Living Grimoire, Coven and Academy with scoped links. Build optional Personal Apothecary inventory and traditional Magical Timing suggestions. Validate cross-feature privacy. |
| 8. Accessibility | Pending | Check focus order, names, chart alternatives, contrast, touch targets, reduced motion, responsive overflow and VoiceOver on new screens. |
| 9. Hosting | Pending account access | Verify Enhance quotas, preview isolation and automatic deployment settings. Run load tests, analyze indexes and query plans, test cache, backup restore and persistent media. |
| 10. Security | Started | Verify block/audience parity, moderation, auth, input validation, rate limits, spam controls, payment, audit, deletion and export on staging. Review Apple UGC readiness with the release owner. |
| 11. Deployment | Pending details | The directive ended at the heading. Proposed sequence is isolated CI, verified staging deploy, smoke tests, review and a rehearsed rollback before scheduling a production cutover. Keep iOS release jobs separate. |

Sources: [GoDaddy resource limits](https://www.godaddy.com/en/help/resource-limits-12001), [GoDaddy components](https://www.godaddy.com/help/which-components-does-my-hosting-support-5614), [GoDaddy Node.js hosting information](https://www.godaddy.com/hosting/web-hosting), [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
