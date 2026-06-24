"""
Resume Parser Service.
Extracts text from PDF or DOCX candidate resumes.
"""
import logging
import os

logger = logging.getLogger(__name__)

def parse_resume(file_path: str) -> str:
    """Parse text from a PDF or DOCX file."""
    if not os.path.exists(file_path):
        logger.error(f"Resume file not found: {file_path}")
        return ""

    ext = file_path.lower().split('.')[-1]
    
    if ext == 'pdf':
        try:
            import fitz  # PyMuPDF
            text = ""
            with fitz.open(file_path) as doc:
                for page in doc:
                    text += page.get_text()
            return text
        except ImportError:
            logger.warning("PyMuPDF not installed, skipping PDF parse.")
            return ""
        except Exception as e:
            logger.error(f"Error parsing PDF: {e}")
            return ""
            
    elif ext in ['doc', 'docx']:
        try:
            from docx import Document
            doc = Document(file_path)
            return "\n".join([p.text for p in doc.paragraphs])
        except ImportError:
            logger.warning("python-docx not installed, skipping DOCX parse.")
            return ""
        except Exception as e:
            logger.error(f"Error parsing DOCX: {e}")
            return ""
            
    else:
        logger.warning(f"Unsupported resume format: {ext}")
        return ""
