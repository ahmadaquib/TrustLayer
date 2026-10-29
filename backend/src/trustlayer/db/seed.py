"""
Seed script to populate initial mock banking data for TrustLayer.

Populates:
1. Roles: customer, staff, approver
2. Synthetic users across all roles
3. Accounts with balances for customers
4. Sample transactions across accounts

Seed data is loaded from data/seed/*.json in the project root.
"""

import asyncio
import json
import pathlib
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from trustlayer.db.models import Account, Role, Transaction, User
from trustlayer.db.session import async_session, engine

# Resolve seed data directory relative to the project root
_THIS_DIR = pathlib.Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent.parent.parent  # backend/src/trustlayer/db -> root
_SEED_DIR = _PROJECT_ROOT / "data" / "seed"


def _load_json(filename: str) -> list[dict]:
    """Load a JSON file from data/seed/."""
    path = _SEED_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Seed data file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


async def seed_data() -> None:
    async with async_session() as session:
        # Check if already seeded
        result = await session.execute(select(Role))
        existing_roles = {r.name: r for r in result.scalars().all()}

        role_names = ["customer", "staff", "approver"]
        roles: dict[str, Role] = {}

        for name in role_names:
            if name in existing_roles:
                roles[name] = existing_roles[name]
            else:
                new_role = Role(name=name)
                session.add(new_role)
                roles[name] = new_role

        await session.flush()

        # Check existing users
        res_users = await session.execute(select(User))
        existing_users = {u.email: u for u in res_users.scalars().all()}

        # Load user definitions from data/seed/users.json
        users_data = _load_json("users.json")
        now = datetime.utcnow()

        created_users: dict[str, User] = {}
        for u_data in users_data:
            email = u_data["email"]
            if email in existing_users:
                created_users[email] = existing_users[email]
            else:
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

        # Accounts for customers
        res_accounts = await session.execute(select(Account))
        existing_account_ids = {a.id for a in res_accounts.scalars().all()}

        # Build email -> user lookup
        email_to_user = created_users

        # Load account definitions from data/seed/accounts.json
        accounts_data = _load_json("accounts.json")
        for acc_data in accounts_data:
            acc_id = uuid.UUID(acc_data["id"])
            if acc_id in existing_account_ids:
                continue
            user = email_to_user[acc_data["user_email"]]
            account = Account(
                id=acc_id,
                user_id=user.id,
                balance=Decimal(acc_data["balance"]),
                account_type=acc_data["account_type"],
            )
            session.add(account)

        await session.flush()

        # Sample transactions
        res_transactions = await session.execute(select(Transaction))
        existing_tx_ids = {t.id for t in res_transactions.scalars().all()}

        # Load transaction definitions from data/seed/transactions.json
        transactions_data = _load_json("transactions.json")
        for tx_data in transactions_data:
            tx_id = uuid.UUID(tx_data["id"])
            if tx_id in existing_tx_ids:
                continue
            offset_days = tx_data.get("created_at_offset_days", 0)
            offset_hours = tx_data.get("created_at_offset_hours", 0)
            tx = Transaction(
                id=tx_id,
                account_id=uuid.UUID(tx_data["account_id"]),
                amount=Decimal(tx_data["amount"]),
                type=tx_data["type"],
                status=tx_data["status"],
                created_at=now + timedelta(days=offset_days, hours=offset_hours),
            )
            session.add(tx)

        await session.commit()
        print("Database seeded successfully with roles, users, accounts, and transactions!")


if __name__ == "__main__":
    asyncio.run(seed_data())
