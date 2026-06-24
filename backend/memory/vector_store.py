"""
Vector Store wrapper using ChromaDB and HuggingFace Embeddings.
Used for matching candidate resumes to Job Descriptions (RAG).
"""
import os
import logging
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document
from backend.config import settings

logger = logging.getLogger(__name__)

# Directory to persist the Chroma database
PERSIST_DIRECTORY = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db")

class VectorStoreManager:
    def __init__(self):
        # We use a fast, lightweight embedding model for standard text matching
        self.embeddings = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL
        )
        self.vector_store = Chroma(
            collection_name="resumes",
            embedding_function=self.embeddings,
            persist_directory=PERSIST_DIRECTORY
        )
        logger.info(f"Initialized ChromaDB at {PERSIST_DIRECTORY}")

    def add_resume(self, candidate_id: str, text_content: str):
        """Add a parsed resume to the vector store."""
        doc = Document(
            page_content=text_content,
            metadata={"candidate_id": candidate_id, "type": "resume"}
        )
        self.vector_store.add_documents([doc])
        logger.info(f"Added resume for candidate {candidate_id} to vector store.")

    def search_resumes(self, query: str, k: int = 5) -> list[tuple[Document, float]]:
        """Search for resumes matching the given query (e.g., JD text)."""
        return self.vector_store.similarity_search_with_score(query, k=k)

# Global singleton instance
vector_store = VectorStoreManager()
