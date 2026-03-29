"""Ingest a PDF into expert_knowledge as summarized chunks.

Example:
    python scripts/ingest_expert_knowledge_pdf.py app/data/CBT-IA_The_First_Treatment_Mo.pdf --category cbt_ia
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

import requests
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.orm import Session


OPENAI_CHAT_API_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_EMBEDDING_API_URL = "https://api.openai.com/v1/embeddings"
DEFAULT_CHAT_MODEL = "gpt-4o-mini"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
MAX_CHARS_PER_CHUNK = 2200
MIN_CHARS_PER_CHUNK = 500


def load_pymupdf() -> Any:
    for module_name in ("pymupdf", "fitz"):
        try:
            return importlib.import_module(module_name)
        except ImportError:
            continue
    raise RuntimeError("PyMuPDF is not installed. Run: pip install PyMuPDF")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract, summarize, embed, and store a PDF in expert_knowledge."
    )
    parser.add_argument("src", help="Source PDF path")
    parser.add_argument(
        "--category",
        default="expert_knowledge_pdf",
        help="Category value stored in expert_knowledge.category",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing expert_knowledge rows for the same source file before insert",
    )
    return parser.parse_args()


def normalize_text(text: str) -> str:
    text = text.replace("\u00ad", "")
    text = text.replace("\x08", "")
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_page_texts(pdf_path: Path) -> List[Dict[str, Any]]:
    fitz = load_pymupdf()
    doc = fitz.open(pdf_path)
    try:
        pages: List[Dict[str, Any]] = []
        for page_index in range(doc.page_count):
            raw_text = doc[page_index].get_text("text")
            clean_text = normalize_text(raw_text)
            if clean_text:
                pages.append(
                    {
                        "page": page_index + 1,
                        "text": clean_text,
                    }
                )
        return pages
    finally:
        doc.close()


def build_chunks(page_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    chunks: List[Dict[str, Any]] = []
    buffer: List[str] = []
    page_start: int | None = None
    page_end: int | None = None
    current_len = 0

    for row in page_rows:
        page = int(row["page"])
        text = str(row["text"]).strip()
        if not text:
            continue

        if page_start is None:
            page_start = page
        page_end = page

        candidate = f"[Page {page}]\n{text}"
        if current_len >= MIN_CHARS_PER_CHUNK and current_len + len(candidate) > MAX_CHARS_PER_CHUNK:
            chunks.append(
                {
                    "page_start": page_start,
                    "page_end": page_end - 1 if page_end and page_end > page_start else page_start,
                    "text": "\n\n".join(buffer).strip(),
                }
            )
            buffer = []
            page_start = page
            current_len = 0

        buffer.append(candidate)
        current_len += len(candidate)

    if buffer and page_start is not None and page_end is not None:
        chunks.append(
            {
                "page_start": page_start,
                "page_end": page_end,
                "text": "\n\n".join(buffer).strip(),
            }
        )

    return chunks


def _openai_headers() -> Dict[str, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


def summarize_chunk(chunk_text: str) -> str:
    prompt = (
        "You summarize expert knowledge for retrieval.\n"
        "Return 4-6 concise bullet points in Korean.\n"
        "Focus on actionable therapeutic or conceptual takeaways.\n"
        "Do not invent facts. Preserve important proper nouns like CBT-IA.\n\n"
        f"Source text:\n{chunk_text}"
    )
    payload = {
        "model": DEFAULT_CHAT_MODEL,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "You create faithful Korean summaries for a retrieval database.",
            },
            {"role": "user", "content": prompt},
        ],
    }
    resp = requests.post(
        OPENAI_CHAT_API_URL,
        headers=_openai_headers(),
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return str(data["choices"][0]["message"]["content"]).strip()


def summarize_chunk_fallback(chunk_text: str) -> str:
    lines = [line.strip() for line in chunk_text.splitlines() if line.strip() and not line.startswith("[Page")]
    preview = " ".join(lines[:8])
    preview = re.sub(r"\s+", " ", preview).strip()
    if len(preview) > 900:
        preview = preview[:900].rstrip() + "..."
    return f"- 원문 발췌 기반 요약\n- {preview}" if preview else "- 원문 발췌 기반 요약"


def embed_text(text: str) -> List[float] | None:
    payload = {
        "model": DEFAULT_EMBEDDING_MODEL,
        "input": text,
    }
    resp = requests.post(
        OPENAI_EMBEDDING_API_URL,
        headers=_openai_headers(),
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["data"][0]["embedding"]


def iter_documents(
    pdf_path: Path,
    category: str,
    chunks: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    docs: List[Dict[str, Any]] = []
    source_file = pdf_path.name
    source_path = str(pdf_path.as_posix())
    total_chunks = len(chunks)

    for index, chunk in enumerate(chunks, start=1):
        chunk_text = str(chunk["text"]).strip()
        if not chunk_text:
            continue

        try:
            summary = summarize_chunk(chunk_text)
            summary_mode = "openai"
        except Exception as exc:
            summary = summarize_chunk_fallback(chunk_text)
            summary_mode = f"fallback:{type(exc).__name__}"

        content = "\n".join(
            [
                f"Source: {source_file}",
                f"Category: {category}",
                f"Pages: {chunk['page_start']}-{chunk['page_end']}",
                "Summary:",
                summary,
                "",
                "Excerpt:",
                chunk_text[:1800],
            ]
        ).strip()

        try:
            embedding = embed_text(content)
            embedding_mode = "openai"
        except Exception as exc:
            embedding = None
            embedding_mode = f"missing:{type(exc).__name__}"

        docs.append(
            {
                "category": category,
                "content": content,
                "embedding": embedding,
                "metadata_": {
                    "source_type": "pdf",
                    "source_file": source_file,
                    "source_path": source_path,
                    "page_start": chunk["page_start"],
                    "page_end": chunk["page_end"],
                    "chunk_index": index,
                    "total_chunks": total_chunks,
                    "summary_mode": summary_mode,
                    "embedding_mode": embedding_mode,
                },
            }
        )

    return docs


def delete_existing_rows(db: Session, source_file: str) -> int:
    from app.models.reports import ExpertKnowledge

    rows = (
        db.query(ExpertKnowledge)
        .filter(ExpertKnowledge.metadata_["source_file"].astext == source_file)
        .all()
    )
    deleted = len(rows)
    for row in rows:
        db.delete(row)
    return deleted


def insert_documents(db: Session, docs: List[Dict[str, Any]]) -> int:
    from app.models.reports import ExpertKnowledge

    inserted = 0
    for doc in docs:
        db.add(
            ExpertKnowledge(
                category=doc["category"],
                content=doc["content"],
                embedding=doc["embedding"],
                metadata_=doc["metadata_"],
            )
        )
        inserted += 1
    return inserted


def sync_expert_knowledge_sequence(db: Session) -> None:
    db.execute(
        text(
            """
            SELECT setval(
                pg_get_serial_sequence('expert_knowledge', 'id'),
                COALESCE((SELECT MAX(id) FROM expert_knowledge), 0) + 1,
                false
            )
            """
        )
    )


def main() -> int:
    load_dotenv()
    args = parse_args()
    pdf_path = Path(args.src).expanduser().resolve()
    if not pdf_path.exists():
        print(f"Source file not found: {pdf_path}")
        return 1

    project_root = Path(__file__).resolve().parents[1]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    import app.models  # noqa: F401
    from app.core.database import SessionLocal

    page_rows = extract_page_texts(pdf_path)
    if not page_rows:
        print("No extractable text found in PDF.")
        return 1

    chunks = build_chunks(page_rows)
    docs = iter_documents(pdf_path, args.category, chunks)
    if not docs:
        print("No documents were generated from the PDF.")
        return 1

    db = SessionLocal()
    try:
        deleted = 0
        if args.replace:
            deleted = delete_existing_rows(db, pdf_path.name)

        sync_expert_knowledge_sequence(db)
        inserted = insert_documents(db, docs)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(
        json.dumps(
            {
                "source_file": pdf_path.name,
                "pages_extracted": len(page_rows),
                "chunks_created": len(chunks),
                "rows_deleted": deleted,
                "rows_inserted": inserted,
                "category": args.category,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
