"""
PDF Text Extraction Utility.

Handles decoding base64-encoded PDFs and extracting text content.
Uses PyMuPDF (fitz) for robust PDF text extraction.
Gracefully falls back to treating input as plain text if it's already text.
"""

import base64
import io
from typing import Optional, Tuple
from ..utils import get_logger

logger = get_logger(__name__)


def extract_text_from_pdf_or_base64(pdf_base64_or_text: str) -> Tuple[str, str]:
    """
    Extract text from either a base64-encoded PDF or treat as plain text.
    
    Uses PyMuPDF (fitz) for PDF extraction - more robust than pypdf
    for both text-based and image-heavy PDFs.
    
    Args:
        pdf_base64_or_text: Either a base64-encoded PDF string or plain text CV content
    
    Returns:
        (extracted_text, source_type) where source_type is "pdf" or "text"
        
    Example:
        >>> text, source = extract_text_from_pdf_or_base64(base64_pdf_string)
        >>> # Returns extracted text and "pdf" as source
    """
    if not pdf_base64_or_text:
        return "", "empty"
    
    # First, try to decode as base64 and extract PDF text
    try:
        # Check if it looks like base64 (no newlines in typical base64 encoding)
        pdf_bytes = base64.b64decode(pdf_base64_or_text)
        
        # Check if it looks like a PDF (starts with %PDF)
        if pdf_bytes.startswith(b'%PDF'):
            try:
                import fitz  # PyMuPDF
                
                # Extract text from PDF using PyMuPDF
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                try:
                    extracted_text = []
                    
                    for page_num, page in enumerate(doc):
                        try:
                            page_text = page.get_text()
                            if page_text:
                                extracted_text.append(page_text)
                                logger.debug(f"📄 Extracted {len(page_text)} chars from page {page_num + 1}")
                        except Exception as page_error:
                            logger.warning(f"⚠️ Failed to extract text from page {page_num + 1}: {page_error}")
                    
                    full_text = "\n".join(extracted_text)
                    
                    if full_text:
                        logger.info(f"✅ [PDF_EXTRACTED] Extracted {len(full_text)} chars from {len(doc)} pages")
                        return full_text, "pdf"
                    else:
                        logger.warning("[PDF_EMPTY] PDF extracted but no text found. Possible image-based PDF.")
                        return "", "pdf_no_text"
                finally:
                    doc.close()
                    
            except ImportError:
                logger.error("[PDF_EXTRACTION_FAILED] PyMuPDF (fitz) not installed. Install with: pip install PyMuPDF")
                return "", "pymupdf_missing"
            except Exception as pdf_error:
                logger.warning(f"[PDF_EXTRACTION_FAILED] Error extracting PDF: {pdf_error}")
                return "", "pdf_extraction_error"
        else:
            # Not a PDF, treat as plain text CV content
            try:
                decoded_text = pdf_bytes.decode('utf-8')
                logger.info(f"✅ [TEXT_DECODED] Decoded {len(decoded_text)} chars from base64-encoded text")
                return decoded_text, "text"
            except UnicodeDecodeError:
                # Binary data that's not a PDF, might be corrupted
                logger.warning("[DECODE_FAILED] Could not decode as UTF-8 or extract as PDF")
                return "", "decode_error"
    
    except Exception as decode_error:
        logger.debug(f"Base64 decode failed: {decode_error}. Treating as plain text.")
    
    # If base64 decode failed or input is not base64, treat as plain text
    if pdf_base64_or_text:
        logger.info(f"✅ [PLAIN_TEXT] Using input as plain text CV ({len(pdf_base64_or_text)} chars)")
        return pdf_base64_or_text, "text"
    
    return "", "empty"
