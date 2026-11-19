# Sales Visit Mobile UI Refactor — Design

## Intent

Make the Sales visit flow easier to scan and operate on a phone during store visits. Establish a calm, consistent visual system and spacing rules that can later cover Area Manager and admin screens. The first release scope is the Sales visit journey; other features follow in separate reviewed increments.

## Current state and why it needs work

- The Sales and Area Manager visit dashboard share `HomeScreen`. On the 360 dp Infinix screen, the current large hero, four equal action cards, and repeated statistic cards push the visit list far below the fold. The Area Manager stack also leaves an unusually tall blank area below its native header.
- `StartVisitScreen` places a 260 dp map above the search and store list. Store cards truncate names and location details and repeat a disabled route action. GPS and missing coordinate states compete for attention.
- `VisitFormScreen` is nearly 1,900 lines with over 100 literal colors. Outcome, audit, photo, and checkout content have inconsistent visual priorities. This makes visual changes risky unless presentation is extracted incrementally.
- Existing shared tokens are teal based, but many Sales visit screens bypass them. Padding, heading size, card treatment, and touch target size vary by screen.

## Chosen approach

**Refactor by journey, screen by screen.** Keep API calls, visit state, validation, offline queue, SQLCipher photo storage, SAP customer lookup, and navigation behavior. Replace presentation incrementally with shared tokens and small view components. The first screen to implement is `HomeScreen`, followed by store selection, visit form, camera and photos, then history and location. Review each on device before the next screen.

Alternatives considered:

1. Cosmetic changes in existing screens: fastest, but repeated color and spacing decisions would remain and the visit journey would still feel fragmented.
2. Chosen phased refactor: creates reusable rules while keeping each release reviewable and limiting regression risk.
3. Rewrite all screens together: allows a clean slate but carries too much functional and UAT risk for the current pilot.

## Visual direction

Field friendly, quiet, and legible outdoors. The main gesture is a clear primary action and a compact visit timeline, not a grid of equally weighted cards. Use left alignment for content and sentence case for labels. Use the platform system font on SDK 54 to keep OTA compatibility; establish a type scale through size, weight, and line height.

Core palette:

| Role | Color | Use |
| --- | --- | --- |
| Canvas | `#F5F7F8` | Page background |
| Surface | `#FFFFFF` | Cards, input fields, toolbar |
| Ink | `#203237` | Main text |
| Muted ink | `#66777A` | Supporting text |
| Primary | `#386A6A` | Main actions, selected controls, links |
| Primary tint | `#E7F0EF` | Quiet emphasis |

Additional semantic colors are reserved for status: success `#336E52` on `#E6F2EB`, caution `#875E26` on `#F7F0E3`, error `#A33F45` on `#FBEDEF`, and border `#DCE5E5`. Color never carries status alone; every state has a text label. These text colors retain at least 4.5:1 contrast on their light status tints; the primary button has 6.1:1 white-on-primary contrast.

Type scale on the existing system font: page title 24/30 semibold, section title 16/22 semibold, body 14/20 regular, field label 13/18 semibold, and caption/status 12/17 medium. Let larger system text wrap rather than clip primary content.

Spacing and shape:

- 8 dp base spacing; 16 dp page edges; 20–24 dp between major sections.
- 14–16 dp inside cards; 12 dp between a label and its related control group; 8–10 dp between closely related items.
- At least 48 dp for primary tap targets and 44 dp for secondary icon controls. Give the final action a safe bottom inset and keep focused inputs reachable above the keyboard.
- Prefer light borders and one level of card elevation. Use 12–16 dp corner radii according to hierarchy; do not give every block the same large rounded card treatment.
- Preserve Android and iOS safe area behavior. Test at 360 dp width and one narrower layout with larger system text.

## Journey and screen behavior

### 1. Dashboard (`HomeScreen`)

- Show greeting, branch, and GPS state in a compact white header. The primary action is `Mulai kunjungan` or `Lanjut kunjungan` when a visit is open.
- Show today's target as one progress panel with unique/duplicate counts. Make the open visit a distinct short row. Keep history, location, and profile available as small secondary actions.
- Present recent visits as compact, readable rows with store name, date/time, outcome, and text status. Preserve photo preview and route access without nested touch conflicts.
- Keep Area Manager's route back to its main dashboard visible when this shared screen is opened from `AdminDashboard`.

### 2. Select store (`StartVisitScreen`)

- Default to the searchable store list; `Peta` reveals the map above that same list so store selection remains available without adding marker-selection behavior. `Daftar` hides the map and returns the list to the top. Search, GPS state, and refresh stay near the top and remain usable when the keyboard opens.
- Give store name and address enough width to wrap. Put SAP code, coordinate/distance state, and the start action in a stable order. Keep route access only when coordinates exist.
- Retain pagination, offline cache behavior, location disclosure, location integrity checks, and duplicate/open-visit handling. No visit starts merely by switching view or selecting a row.

### 3. Visit form (`VisitFormScreen`)

- Keep a single scrollable form; use section headings for store/check-in, result, photos, and checkout. A short progress cue describes the existing sequence without introducing new validation steps.
- Show the location audit result in the summary, with detailed coordinates available by expansion. Keep all audit fields accessible and unchanged.
- Align labels, inputs, picker rows, notes, photo actions, and disabled states to shared components. A reachable checkout action follows the form and respects the keyboard/safe area.
- Preserve checkout payloads, online/offline outcomes, cancellation, photo limits, and all currently enabled fields. Keep unfinished payment and receivables features hidden as they are now.

### 4. Camera, photos, and review

- Keep the camera dark for legibility; give the shutter, photo count, close, and preview controls clear positions. The preview explains the five-photo limit, removal, and save state.
- Preserve encrypted offline photo writes, temporary-file cleanup, retries, and gallery permissions. No new native package or camera behavior is introduced by the visual pass.

### 5. Summary and location

- Reuse the compact visit row and status treatment in `MySummaryScreen` and `VisitPhotoGalleryScreen`. Keep empty/loading/error states actionable and specific.
- Make `MyLocationScreen` GPS accuracy, recency, and tracking consent easy to read without changing tracking semantics.

## Release sequence and verification

1. Foundation: add Sales visit design tokens and view primitives without changing the shared admin appearance yet. Review phone-width mockups before product code changes.
2. Dashboard: implement and test navigation, target/loading/empty/open visit states, photo preview, and Area Manager back navigation.
3. Store list and map: test search, pagination, route action, GPS status, disclosure, and offline cache.
4. Visit form and camera: test keyboard, validation, check-in/checkout, photo capture, offline restart, and reconnect/sync.
5. Summary, gallery, location: test history/detail navigation, photo review, and tracking state.
6. Publish one staging OTA for the complete Sales visit journey after the code, bundle, regression suite, and device smoke test are ready. This avoids exposing Sales UAT users to an inconsistent partial redesign. Extend the approved visual system to Area Manager and admin in later reviewed increments.

Each local increment receives a bundle export, existing regression tests, and a layout review. The complete Sales journey receives the device visual and end-to-end smoke pass before/after its staging OTA. The user confirmed that a Sales test account and dummy store are available; the user logs in on the phone, and the smoke test uses only that data so UAT records are not mixed with real customer visits. If access is unavailable when the test is due, keep staging on its current version and report the unverified flow. No production OTA or SDK upgrade is part of this design. The SDK 54 runtime and current package remain. If a screen's new layout exposes a functional bug, fix and verify it within that increment before moving on.

## Review artifact

The browser mockup shows Dashboard, Select Store, and Visit Form at phone width. It illustrates hierarchy, palette, and padding; sample names and figures are fictional. It is a visual reference, not a specification of new backend behavior.

## Decisions for the implementer

- Extract view components only where they remove repeated presentation code; keep API/state orchestration in current screens during the first pass.
- Prefer existing React Native and Expo SDK 54 packages. Keep changes OTA compatible.
- Use user-facing Indonesian wording consistently: `kunjungan`, `toko`, `hasil`, `foto`, and `checkout` only where the action actually completes checkout.
- Do not publish an increment on the strength of a visual screenshot alone; verify functional paths and encrypted offline data behavior.
