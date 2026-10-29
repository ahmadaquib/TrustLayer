"""
Seed script for synthetic banking knowledge base documents.

NOTE: All policies contained herein are completely SYNTHETIC and designed solely
for research and demonstration of TrustLayer's access-aware RAG and claim-grounding pipeline.
They do NOT represent any actual bank's real policies or private information.
"""

import asyncio
import json
import pathlib
import uuid
from typing import Any

from sqlalchemy import select
from trustlayer.db.models import KBDocument
from trustlayer.db.session import async_session

# Resolve KB docs from data/kb/ relative to the project root
# Project layout: backend/src/trustlayer/db/seed_kb.py -> root is 5 levels up
_THIS_DIR = pathlib.Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent.parent.parent  # backend/src/trustlayer/db -> root
_KB_DIR = _PROJECT_ROOT / "data" / "kb"


def load_kb_documents() -> list[dict[str, Any]]:
    """Load all KB document JSON files from data/kb/."""
    docs = []
    if not _KB_DIR.exists():
        raise FileNotFoundError(f"KB data directory not found: {_KB_DIR}")
    for json_file in sorted(_KB_DIR.glob("doc_*.json")):
        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["id"] = uuid.UUID(data["id"])
        docs.append(data)
    return docs


async def seed_kb_documents() -> None:
    """Populates kb_documents with synthetic policies."""
    documents = load_kb_documents()

    async with async_session() as session:
        result = await session.execute(select(KBDocument.id))
        existing_ids = set(result.scalars().all())

        added_count = 0
        for doc_data in documents:
            if doc_data["id"] in existing_ids:
                continue
            doc = KBDocument(
                id=doc_data["id"],
                title=doc_data["title"],
                content=doc_data["content"],
                source=doc_data["source"],
                role_scope=doc_data["role_scope"],
            )
            session.add(doc)
            added_count += 1

        await session.commit()
        print(f"Seeded {added_count} synthetic KB documents (total documents: {len(documents)}).")


if __name__ == "__main__":
    asyncio.run(seed_kb_documents())
