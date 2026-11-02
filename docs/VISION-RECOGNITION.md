# Real image recognition

Scanned pages and image uploads now call the authenticated recognition/vision Edge Function before saving. Tesseract supplies only a hint; the vision model receives the original page image. Clear results bypass manual review, including abnormal results. Uncertain results are blank until entered or excluded. Provider failure stops the upload rather than silently accepting OCR. Native PDF text and text files retain the existing direct-text path.

The default provider reuses the existing **DEEPSEEK_API_KEY** server secret, calling https://api.deepseek.com/chat/completions with **deepseek-flash**, which accepts image inputs. No additional key is required. Deploy make-server-ba71e98d to activate the new route. Existing text generation remains unchanged.

Official vision documentation: https://api-docs.deepseek.com/guides/vision/ .

Optional provider override: set all three Supabase Secrets VISION_API_KEY, VISION_BASE_URL (HTTPS base URL without /chat/completions), VISION_MODEL. Partial overrides fail closed so the DeepSeek key is never sent to an alternative provider. Never put keys in frontend variables.

Images are transmitted to the configured model provider. No image/base64 or provider credentials are logged by the route. Model output is a fallible visibility assessment, not an accuracy guarantee. Existing uploaded reports are not reprocessed automatically.
