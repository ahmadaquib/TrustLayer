#!/usr/bin/env python3
"""
TrustLayer Demo Database Reset Script.

Idempotently resets runtime state and reloads seed demo data:
1. Verifies DATABASE_URL points at localhost (refuses to execute otherwise).
2. Clears runtime tables:
   - audit_log, decisions, policy_checks, grounding_results, claims,
   - agent_actions, chat_messages, chat_sessions
3. Clears and reloads banking domain tables from data/seed/*.json:
   - transactions, accounts, users
4. Leaves knowledge base tables (kb_documents, kb_embeddings) and roles untouched.
5. Executes inside a single database transaction.
6. Prints before/after row counts for verification.
"""

import asyncio
import json
import os
import pathlib
import sys
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from urllib.parse import urlparse

# Ensure backend/src is on the module search path
_SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
_SRC_DIR = _SCRIPT_DIR.parent / "src"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from sqlalchemy import delete, func, select
from trustlayer.config import settings
from trustlayer.db.models import (
    Account,
    AgentAction,
    AuditLog,
    ChatMessage,
    ChatSession,
    Claim,
    Decision,
    GroundingResult,
    KBDocument,
    KBEmbedding,
    PolicyCheck,
    Role,
    Transaction,
    User,
)
from trustlayer.db.session import async_session

_REPO_ROOT = _SCRIPT_DIR.parent.parent
_SEED_DIR = _REPO_ROOT / "data" / "seed"


def verify_localhost_database(db_url: str) -> None:
    """Refuses execution unless DATABASE_URL strictly points to localhost."""
    # Handle postgresql+asyncpg:// format
    normalized_url = db_url.replace("+asyncpg", "")
    parsed = urlparse(normalized_url)
    hostname = (parsed.hostname or "").lower()

    if hostname not in ("localhost", "127.0.0.1", "::1"):
        print(f"[FATAL ERROR] DATABASE_URL points to non-local host: '{hostname}'.")
        print("This script is restricted to local development environments only.")
        sys.exit(1)


def _load_json(filename: str) -> list[dict]:
    path = _SEED_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Seed data file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


async def get_row_counts(session) -> dict[str, int]:
    """Retrieves current row counts for all database tables."""
    tables = [
        ("audit_log", AuditLog),
        ("decisions", Decision),
        ("policy_checks", PolicyCheck),
        ("grounding_results", GroundingResult),
        ("claims", Claim),
        ("agent_actions", AgentAction),
        ("chat_messages", ChatMessage),
        ("chat_sessions", ChatSession),
        ("transactions", Transaction),
        ("accounts", Account),
        ("users", User),
        ("roles", Role),
        ("kb_documents", KBDocument),
        ("kb_embeddings", KBEmbedding),
    ]
    counts = {}
    for name, model in tables:
        res = await session.execute(select(func.count()).select_from(model))
        counts[name] = res.scalar() or 0
    return counts


async def reset_demo_db() -> None:
    print("=" * 76)
    print(" TrustLayer — Demo Database Reset & Reseed")
    print("=" * 76)

    # 1. Safety check
    verify_localhost_database(settings.database_url)
    print(f"[1/4] Safety verification passed: DATABASE_URL points to localhost.")

    async with async_session() as session:
        # 2. Before counts
        before_counts = await get_row_counts(session)

        # 3. Begin single transaction execution
        print("\n[2/4] Clearing runtime and domain data...")

        # Clear runtime records in reverse foreign-key order
        await session.execute(delete(AuditLog))
        await session.execute(delete(Decision))
        await session.execute(delete(PolicyCheck))
        await session.execute(delete(GroundingResult))
        await session.execute(delete(Claim))
        await session.execute(delete(AgentAction))
        await session.execute(delete(ChatMessage))
        await session.execute(delete(ChatSession))

        # Clear mock banking domain records
        await session.execute(delete(Transaction))
        await session.execute(delete(Account))
        await session.execute(delete(User))
        await session.flush()

        print("[3/4] Reloading seed users, accounts, and transactions...")

        # Ensure base roles exist
        res_roles = await session.execute(select(Role))
        existing_roles = {r.name: r for r in res_roles.scalars().all()}
        roles: dict[str, Role] = {}
        for role_name in ["customer", "staff", "approver"]:
            if role_name in existing_roles:
                roles[role_name] = existing_roles[role_name]
            else:
                new_role = Role(name=role_name)
                session.add(new_role)
                roles[role_name] = new_role
        await session.flush()

        # Seed Users from data/seed/users.json
        users_data = _load_json("users.json")
        now = datetime.utcnow()
        created_users: dict[str, User] = {}
        for u_data in users_data:
            email = u_data["email"]
            offset_days = u_data.get("created_at_offset_days", 0)
            user = User(
                id=uuid.UUID(u_data["id"]),
                name=u_data["name"],
                email=email,
                role_id=roles[u_data["role"]].id,
                created_at=now + timedelta(days=offset_days),
            )
            session.add(user)
            created_users[email] = user
        await session.flush()

        # Seed Accounts from data/seed/accounts.json
        accounts_data = _load_json("accounts.json")
        for acc_data in accounts_data:
            user = created_users[acc_data["user_email"]]
            account = Account(
                id=uuid.UUID(acc_data["id"]),
                user_id=user.id,
                balance=Decimal(acc_data["balance"]),
                account_type=acc_data["account_type"],
            )
            session.add(account)
        await session.flush()

        # Seed Transactions from data/seed/transactions.json
        transactions_data = _load_json("transactions.json")
        for tx_data in transactions_data:
            offset_days = tx_data.get("created_at_offset_days", 0)
            offset_hours = tx_data.get("created_at_offset_hours", 0)
            tx = Transaction(
                id=uuid.UUID(tx_data["id"]),
                account_id=uuid.UUID(tx_data["account_id"]),
                amount=Decimal(tx_data["amount"]),
                type=tx_data["type"],
                status=tx_data["status"],
                created_at=now + timedelta(days=offset_days, hours=offset_hours),
            )
            session.add(tx)

        # Commit single transaction
        await session.commit()
        print("[4/4] Transaction committed successfully.")

        # 4. After counts
        after_counts = await get_row_counts(session)

    # 5. Print summary table
    print("\n" + "=" * 76)
    print(f"{'Table':<26} | {'Before':<12} | {'After':<12} | {'Status':<16}")
    print("-" * 76)
    all_tables = [
        "audit_log",
        "decisions",
        "policy_checks",
        "grounding_results",
        "claims",
        "agent_actions",
        "chat_messages",
        "chat_sessions",
        "transactions",
        "accounts",
        "users",
        "roles",
        "kb_documents",
        "kb_embeddings",
    ]
    for tbl in all_tables:
        b = before_counts.get(tbl, 0)
        a = after_counts.get(tbl, 0)
        if tbl in ("roles", "kb_documents", "kb_embeddings"):
            status = "Untouched"
        elif tbl in ("users", "accounts", "transactions"):
            status = "Reseeded"
        else:
            status = "Cleared"
        print(f"{tbl:<26} | {b:<12} | {a:<12} | {status:<16}")
    print("=" * 76)
    print("Demo database reset complete.\n")


if __name__ == "__main__":
    asyncio.run(reset_demo_db())

