"""Verify a PDF can be opened and re-saved with PyMuPDF.

Example:
    python scripts/check_pdf_preservation.py app/data/CBT-IA_The_First_Treatment_Mo.pdf
"""

from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path
from typing import Any


def load_pymupdf() -> Any:
    for module_name in ("pymupdf", "fitz"):
        try:
            return importlib.import_module(module_name)
        except ImportError:
            continue

    print("PyMuPDF is not installed. Run: pip install PyMuPDF")
    sys.exit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Open a PDF with PyMuPDF and save a copy to verify preservation."
    )
    parser.add_argument("src", help="Source PDF path")
    parser.add_argument(
        "--output",
        "-o",
        help="Output PDF path. Defaults to <original_stem>_pymupdf_copy.pdf in the same directory.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    fitz = load_pymupdf()
    src = Path(args.src).expanduser().resolve()
    if not src.exists():
        print(f"Source file not found: {src}")
        return 1

    output = (
        Path(args.output).expanduser().resolve()
        if args.output
        else src.with_name(f"{src.stem}_pymupdf_copy{src.suffix}")
    )

    doc = fitz.open(src)
    try:
        print(f"Opened: {src}")
        print(f"Pages: {doc.page_count}")
        print(f"Is PDF: {doc.is_pdf}")
        print(f"Needs password: {doc.needs_pass}")
        print(f"Metadata: {doc.metadata}")

        # Save as a new file to preserve the original binary untouched.
        doc.save(output)
        print(f"Saved copy: {output}")
    finally:
        doc.close()

    reopened = fitz.open(output)
    try:
        print(f"Re-opened saved copy successfully: {output}")
        print(f"Saved copy pages: {reopened.page_count}")
        print(f"Saved copy metadata: {reopened.metadata}")
    finally:
        reopened.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
