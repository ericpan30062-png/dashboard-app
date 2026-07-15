import io
import os
from typing import Optional

import pdfplumber
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Syllabus PDF Extractor")

SHARED_SECRET = os.environ.get("PDF_EXTRACTOR_SHARED_SECRET")
ALLOWED_ORIGIN = os.environ.get("PDF_EXTRACTOR_ALLOWED_ORIGIN", "http://localhost:3000")
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_methods=["POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/extract")
async def extract(
    file: UploadFile = File(...),
    x_shared_secret: Optional[str] = Header(default=None, alias="X-Shared-Secret"),
):
    # Only enforced when PDF_EXTRACTOR_SHARED_SECRET is set, so local dev
    # without the env var configured still works out of the box.
    if SHARED_SECRET and x_shared_secret != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="invalid shared secret")

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="file must be a PDF")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file exceeds 20MB limit")

    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            pages_text = [page.extract_text() or "" for page in pdf.pages]
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"failed to parse PDF: {exc}") from exc

    text = "\n\n".join(pages_text).strip()
    if not text:
        raise HTTPException(
            status_code=422,
            detail="no extractable text found in PDF (it may be a scanned image)",
        )

    return {"text": text, "page_count": len(pages_text)}
