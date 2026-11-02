# Checking scanned report values

## User flow

1. Select images and/or PDFs and start upload.
2. Each image (and each PDF page without a text layer) is read with Tesseract in automatic-layout mode, then every result row is checked (see below).
3. **If nothing looks wrong, the upload continues straight to report generation — no manual step.**
4. If something looks wrong, **Check unclear values** opens. It lists only the affected test results, one card per test (e.g. *Hemoglobin / 血红蛋白*), never "page 1 · line 9". Each card shows:
   - a crop of that row from the original, and a numbered box on the full image;
   - what was read, why it was flagged, and — when other results allow it — the value range they imply (e.g. "With Hematocrit 34.2%, Hemoglobin should be about 109–123 g/L");
   - a field for the value on the original, plus quick answers: *Original shows 35.3* (when a missed decimal point is likely), *112 is correct*, or *Can't read it — leave this out*.
5. The report switcher at the top lists every uploaded file with its own status ("3 to check", "✓ All clear"). Switching report switches the original and the cards.
6. **Confirm & generate report** becomes available once every card is answered. Only the corrected rows change; the source image/PDF is unchanged. Cancel or leaving the page saves nothing.
7. *Edit all recognized text* is still available for anything the checks missed; using it requires the "I compared this text…" checkbox for that file.

## What gets flagged (`src/lib/recognition-review.ts`)

Rows are rebuilt from word positions so a test name stays with its result, unit and reference range, and are matched to ~50 known tests (English and Chinese names). Unknown tests with a number, unit and range are still checked for image problems.

| Check | Example from `test image/` |
| --- | --- |
| **Blurred number** – edge sharpness of the result is far below the other results on the page | 模糊test1: Hemoglobin, Platelets |
| **Faded digit** – one character much lighter than the rest | 模糊test2: Albumin "35**3**" |
| **Partly covered** – result contains non-numeric characters | 模糊test3: Platelets "13¢" |
| **Result not found** – row has a name/unit/range but no result | 模糊test3: Creatinine |
| **Impossible value** – outside physiological limits; suggests the decimal-shifted value | Albumin 353 g/L → 35.3? |
| **Doesn't fit other results** – HGB vs HCT, MCV = HCT/RBC, MCH, MCHC, WBC ≥ sum of differential, % sum ≤ 100, DBIL ≤ TBIL, ALB ≤ TP. The value that is to blame is chosen using independent evidence (blur, other relations that confirm the rest, which decimal repair makes everything consistent); if nothing decides, both values are shown. | Hemoglobin 142 vs Hematocrit 34.2%; Lymphocytes 12 when WBC is 4.6 |
| **Reference range unclear** – low-confidence range ~10× off the usual range | "11-32" for 1.1-3.2 |
| **Unit** – garbled units are completed from the test (`1049/L` → `10^9/L`); asked only if the unit system can't be decided from the reference range | g/L vs g/dL |
| **Hard to read** – result OCR confidence < 60 | |

Abnormal-but-possible results (e.g. bilirubin 126 µmol/L printed clearly) are **not** flagged: the checks look for reading errors, not for abnormal results. A flagged value that still fits the other results says so ("112 fits with Hematocrit 34.2%, so it is probably right") so confirming is quick. Values are never changed without the person choosing them.

Narrative pages (CT, pathology) have no result table; only numbers with very low confidence, unreadable dates and empty/unreadable pages are flagged there.

## Limits

These are heuristics. A number that is completely missing from the photo can only be caught when its row is still visible; a misread that is sharp, physically possible and consistent with every other result cannot be detected. The Tesseract default single-block mode produced garbage on bordered tables ("Rr EE", "sens | as | won"), which is why `recognition.ts` sets `PSM.AUTO`.

## Validation

```powershell
npm.cmd install --prefix tmp/manual-review-tests --no-save --package-lock=false jsdom
node scripts/test-recognition-review.cjs
pnpm.cmd exec tsc --noEmit
```

The test covers: clean report passes with no dialog; Hemoglobin/HCT conflict names Hemoglobin with 109–123 g/L; dropped decimal in Lymphocytes is blamed on Lymphocytes (suggests 1.2); impossible Albumin suggests 35.3 while clear bilirubin 126 is not flagged; covered and missing results; Chinese names split by OCR spaces; blur detection on a synthetic image; corrected text is what gets uploaded; report switcher; cancel/unmount write nothing; native-text PDFs unchanged.

To see the dialog with real OCR without logging in, open the dev server and run in the browser console:

```js
(await import('/tmp/review-preview.tsx')).previewReview(['模糊test1.png', '模糊test2.png', '模糊test3.png'])
```

No database migration or Edge Function deployment is required. Publish the frontend to make it available outside the local preview.
