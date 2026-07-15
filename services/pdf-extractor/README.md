# Syllabus PDF Extractor

Small FastAPI microservice that extracts text from an uploaded PDF using
[pdfplumber](https://github.com/jsvine/pdfplumber). Called by the Next.js app's
`/api/syllabus/extract` route — it never talks to Postgres, Clerk, or
Anthropic directly.

## Run locally

```bash
cd services/pdf-extractor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Optional: require callers to send a shared secret (recommended once this
# is reachable over a network, not just localhost). Must match
# PDF_EXTRACTOR_SHARED_SECRET in the Next.js app's .env.
export PDF_EXTRACTOR_SHARED_SECRET=some-long-random-string

uvicorn main:app --reload --port 8000
```

## API

`POST /extract` — multipart form with a `file` field (PDF only, ≤20MB).
Returns:

```json
{ "text": "...extracted text...", "page_count": 3 }
```

`GET /health` — liveness check.
