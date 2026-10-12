# Architecture decision record — Alpha

Status: describes current implementation; future additions require separate decisions.

## Data flow

React UI → PDF.js/Tesseract.js in browser → authenticated Edge Function → private Storage originals and PostgreSQL key-value records → backend DeepSeek API call → answers/validated summaries → UI. Saved summaries belong to the account and upload batch. Chat retrieves relevant recognized text from the current account's records.

## Decisions

| Choice | Purpose and tradeoff |
| --- | --- |
| React + TypeScript + Vite | Iterative browser UI and static checking; not a native app distribution |
| Tailwind CSS | Shared UI styling |
| Supabase PostgreSQL + Storage + Edge Functions | Combined persistence, file storage and APIs; custom account/session implementation currently used, not Supabase Auth |
| PDF.js + Tesseract.js | Browser text extraction/OCR; sensitive to image quality and device resources |
| Server-side DeepSeek integration | Keeps API key out of browser; depends on network/service availability and requires consent for medical-text transmission |
| Private original files + source validation | Preserves evidence; report fields checked against recognized source, not guaranteed against image truth |
| Concise report limits | Reduces lengthy output failures; cannot replace complete source documents |

## Risks and limits

OCR can misread numbers. Redaction is rule-based and incomplete. AI answers require evaluation and must not be treated as verified clinical advice. Account ownership checks protect record access, but a broader security review remains outstanding. Rate limits, file limits, slow OCR and API errors affect usability. Trend charts, review workflows and full teacher-template fields must not be claimed complete without testing their underlying implementation.
