"""
Regression tests for two safety fixes in agent/loop.py:

Fix 1 — Grounding else-branch:
  (a) Zero claims extracted (grounding N/A) → grounding_score=1.0, no error.
  (b) Claims extracted but ALL per-claim NLI/retrieval raised → grounding_error propagated
      → money-moving tools: decision != "allow" (APPROVE or BLOCK)
      → read-only tools: fail-open with grounding_unavailable warning

Fix 2 — Policy engine exception:
  Runtime crash in check_rbac or check_sequence_anomaly is caught and routed through
  evaluate_decision(policy_error=...) → logged BLOCK with audit record, not HTTP 500.

All tests use mocks; no DB, no NLI model, no Gemini API required.
"""

import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_fake_session():
    """Create a minimal fake AsyncSession that satisfies loop.py's DB calls."""
    session = AsyncMock()
    # session.execute() must return a result with .scalar_one_or_none()
    fake_result = MagicMock()
    fake_user = SimpleNamespace(
        id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        role_id=1,
    )
    fake_role = SimpleNamespace(id=1, name="customer")
    fake_chat_session = SimpleNamespace(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        user_id=fake_user.id,
        started_at=datetime.utcnow(),
    )

    call_count = {"n": 0}

    def _scalar_one_or_none():
        call_count["n"] += 1
        # First call: resolve chat session, second: user lookup, third: role lookup
        seq = call_count["n"]
        if seq == 1:
            return fake_chat_session
        if seq == 2:
            return fake_user
        if seq == 3:
            return fake_role
        return None

    fake_result.scalar_one_or_none = _scalar_one_or_none
    session.execute = AsyncMock(return_value=fake_result)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session


USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
SESSION_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

# We patch record_audit_pipeline to avoid real DB writes and capture calls.
AUDIT_PATCH = "trustlayer.agent.loop.record_audit_pipeline"
EXTRACT_PATCH = "trustlayer.agent.loop.extract_claims"
RETRIEVE_PATCH = "trustlayer.agent.loop.retrieve_evidence"
VERIFY_PATCH = "trustlayer.agent.loop.verify_claim_against_chunks"
RBAC_PATCH = "trustlayer.agent.loop.check_rbac"
SEQ_PATCH = "trustlayer.agent.loop.check_sequence_anomaly"
EXECUTE_PATCH = "trustlayer.agent.loop.execute_tool"


# ---------------------------------------------------------------------------
# Fix 1(b): Claims extracted, all verification failed → money-moving → NOT allow
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("tool_msg,tool_name", [
    ("transfer $500 to Bob. The overdraft limit is $2000.", "transfer_funds"),
    ("I lost card and need to freeze it. The policy says I can unblock anytime.", "block_card"),
    ("dispute the charge on transaction abc. The fee is waived for me.", "dispute_charge"),
])
@pytest.mark.asyncio
async def test_fix1b_money_moving_all_claims_failed_not_allow(tool_msg, tool_name):
    """When claims are extracted but all NLI/retrieval raises, money-moving tools
    must NOT receive ALLOW.  They must land on APPROVE or BLOCK."""
    from trustlayer.agent.loop import run_agent_loop

    fake_session = _make_fake_session()

    with (
        patch(EXTRACT_PATCH, return_value={"claims": ["some false claim"], "error": None}),
        patch(RETRIEVE_PATCH, side_effect=RuntimeError("NLI infra down")),
        patch(RBAC_PATCH, return_value={"allowed": True, "hard_deny": False, "reason": "ok"}),
        patch(SEQ_PATCH, new_callable=AsyncMock, return_value={"flagged": False, "policy_risk": 0.0}),
        patch(AUDIT_PATCH, new_callable=AsyncMock, return_value=(uuid.uuid4(), uuid.uuid4())),
        patch(EXECUTE_PATCH, new_callable=AsyncMock, return_value={"status": "should_not_run"}),
    ):
        result = await run_agent_loop(
            session=fake_session,
            user_id=USER_ID,
            message=tool_msg,
            role="customer",
            session_id=SESSION_ID,
        )

    assert result["decision"] != "allow", (
        f"Money-moving tool '{tool_name}' must not ALLOW when all claim verification failed. "
        f"Got decision='{result['decision']}'"
    )


# ---------------------------------------------------------------------------
# Fix 1(b): Claims extracted, all verification failed → read-only → fail-open OK
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fix1b_read_only_all_claims_failed_failopen():
    """When claims are extracted but all NLI/retrieval raises, read-only tools
    should fail-open (grounding_unavailable warning), decision = allow."""
    from trustlayer.agent.loop import run_agent_loop

    fake_session = _make_fake_session()

    with (
        patch(EXTRACT_PATCH, return_value={"claims": ["balance is unlimited"], "error": None}),
        patch(RETRIEVE_PATCH, side_effect=RuntimeError("NLI infra down")),
        patch(RBAC_PATCH, return_value={"allowed": True, "hard_deny": False, "reason": "ok"}),
        patch(SEQ_PATCH, new_callable=AsyncMock, return_value={"flagged": False, "policy_risk": 0.0}),
        patch(AUDIT_PATCH, new_callable=AsyncMock, return_value=(uuid.uuid4(), uuid.uuid4())),
        patch(EXECUTE_PATCH, new_callable=AsyncMock, return_value={"status": "success", "accounts": []}),
    ):
        result = await run_agent_loop(
            session=fake_session,
            user_id=USER_ID,
            message="check my balance. The account has unlimited overdraft.",
            role="customer",
            session_id=SESSION_ID,
        )

    assert result["decision"] == "allow", (
        f"Read-only tool should fail-open when all claims fail. Got '{result['decision']}'"
    )


# ---------------------------------------------------------------------------
# Fix 1(a): No claims extracted on a plain transfer → unchanged behaviour
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fix1a_no_claims_plain_transfer_unchanged():
    """A plain 'transfer $150 to Bob' with zero extracted claims should keep
    grounding_score=1.0 and proceed normally (unchanged from prior behaviour)."""
    from trustlayer.agent.loop import run_agent_loop

    fake_session = _make_fake_session()

    with (
        # Zero claims extracted — this is the N/A case
        patch(EXTRACT_PATCH, return_value={"claims": [], "error": None}),
        patch(RBAC_PATCH, return_value={"allowed": True, "hard_deny": False, "reason": "ok"}),
        patch(SEQ_PATCH, new_callable=AsyncMock, return_value={"flagged": False, "policy_risk": 0.0}),
        patch(AUDIT_PATCH, new_callable=AsyncMock, return_value=(uuid.uuid4(), uuid.uuid4())),
        patch(EXECUTE_PATCH, new_callable=AsyncMock, return_value={
            "status": "success", "action": "transfer_funds",
            "amount": 150.0, "recipient": "Bob", "new_balance": 850.0,
            "transaction_id": str(uuid.uuid4()),
        }),
    ):
        result = await run_agent_loop(
            session=fake_session,
            user_id=USER_ID,
            message="transfer $150 to Bob",
            role="customer",
            session_id=SESSION_ID,
        )

    # grounding_score should be 1.0 (N/A, not failure) and decision should be allow
    assert result["grounding_score"] == 1.0, f"Expected grounding_score=1.0, got {result['grounding_score']}"
    assert result["decision"] == "allow", f"Expected allow, got {result['decision']}"


# ---------------------------------------------------------------------------
# Fix 2: Policy engine exception → BLOCK with audit record
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fix2_policy_exception_block_with_audit():
    """A RuntimeError in check_rbac must result in BLOCK (not HTTP 500) and
    an audit record must be written."""
    from trustlayer.agent.loop import run_agent_loop

    fake_session = _make_fake_session()
    audit_mock = AsyncMock(return_value=(uuid.uuid4(), uuid.uuid4()))

    with (
        patch(EXTRACT_PATCH, return_value={"claims": [], "error": None}),
        patch(RBAC_PATCH, side_effect=RuntimeError("RBAC database connection lost")),
        patch(AUDIT_PATCH, new_callable=lambda: lambda *a, **kw: audit_mock(*a, **kw)),
        patch(EXECUTE_PATCH, new_callable=AsyncMock, return_value={"status": "should_not_run"}),
    ):
        result = await run_agent_loop(
            session=fake_session,
            user_id=USER_ID,
            message="transfer $200 to Alice",
            role="customer",
            session_id=SESSION_ID,
        )

    # Must be BLOCK, not an unhandled crash
    assert result["decision"] == "block", f"Expected block, got {result['decision']}"
    # Audit pipeline must have been called (record written)
    assert audit_mock.call_count >= 1, "Audit record must be written on policy engine failure"
