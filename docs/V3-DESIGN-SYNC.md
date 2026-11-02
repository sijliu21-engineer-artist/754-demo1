# CaseMate V3 design sync
Target: Figma 9kksM2vNAlHn1b6e9ZE7LH, page 2046:6249.
The visual contract is a 393 px mobile canvas; larger browser windows center the app.
The app retains its real Supabase account and upload APIs. Sample values in Figma are not hardcoded as account records.
Changed: shared V3 layout, comparison entry and numeric change summary, explicit manually entered value confirmation, exclusion label, upload save-phase message.
Raw OCR guesses are no longer accepted through a one-click numeric suggestion.
The previous UI refresh stylesheet remains on disk but is not imported by the V3 build.

Deployment target: https://casemate-v3-user-test.vercel.app
The cloud vision endpoint returned 404 during QA. Missing/unavailable vision routes now use browser OCR checks and the same explicit user review; authentication failures are not bypassed.
Verified: typecheck/build; real isolated account registration/login; two saved synthetic reports and values 112/109 g/L; chart delta, table and original access; explicit correction confirmation, exclusion, edit invalidation and Escape cancellation; real image upload reaches the saved-report route.
