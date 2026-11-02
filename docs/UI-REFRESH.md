# CaseMate UI refresh

The interface keeps the existing forest green (`#214e3b`), sage and off-white palette. Shared styling lives in `src/ui-refresh.css`, loaded after the original stylesheet. Existing API, account and OCR behavior is preserved.

## Applied UX principles

Reference: https://lawsofux.com/

- **Hick's Law / choice overload:** the report landing page separates Organise, Understand and Compare, rather than presenting equally weighted actions in one card.
- **Common region / proximity:** related labels, explanatory text and actions share one card. Search occupies its own full-width region on wider displays.
- **Fitts's Law:** primary controls have a minimum 44–50px target, with spacing between adjacent actions.
- **Jakob's Law:** persistent navigation retains its existing destinations, labels and active state.
- **Response feedback:** upload activity, question loading, selected navigation and empty search results provide explicit feedback. Animation does not simulate progress or shorten actual network latency.

## Motion

Page and message entry use short fades with small vertical movement. Buttons have hover and press feedback, navigation icons settle into place, active uploads use an indeterminate spinner, and chart lines reveal when mounted. `prefers-reduced-motion: reduce` disables these animations and transitions while keeping chart lines visible.

## Coverage

Global rules cover login, report upload and display, assistant messages, indicator tables/charts, profile, settings, original-file display, sharing dialogs and review screens. The report landing page and welcome page also have updated composition and copy. Indicator search now reports matching counts and offers a clear-search action when no match exists.

## Verification

- TypeScript: `pnpm exec tsc --noEmit`.
- Production build: `pnpm build` (Vite runner config loader).
- The live welcome page was observed after hot reload.
- Full authenticated navigation, uploads, AI responses and responsive interaction checks still need browser verification; changing shared styles is not proof that every flow has passed.

The Vite alias uses `import.meta.url` for ESM compatibility. The build script uses the runner loader to avoid the Windows native Tailwind dependency being bundled as a text module during config loading.
