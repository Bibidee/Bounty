"""Direct-mode tests for contracts/bounty_verdict.py.

Run with:
    "C:/Users/ojiku/AppData/Local/Programs/Python/Python312/python.exe" -m pytest tests/direct -v
"""

import json

import pytest

CONTRACT_PATH = "contracts/bounty_verdict.py"


def as_hex(addr) -> str:
    # Only safe to call after a direct_deploy() in the same test, which is
    # what adds the genlayer SDK to sys.path for that test's duration.
    from genlayer.py.types import Address

    return Address(addr).as_hex

SCOPE = "Any remote code execution or authentication bypass in the main branch."
ISSUES_URL = "https://api.github.com/repos/example/repo/issues"
PROMPT_MARKER = r"adjudicating a security bug bounty"


def deploy(direct_vm, direct_deploy, direct_owner, min_bond=100):
    direct_vm.sender = direct_owner
    return direct_deploy(
        CONTRACT_PATH,
        direct_owner,
        ISSUES_URL,
        SCOPE,
        min_bond,
    )


def llm_response(outcome: str, reason: str = "because") -> str:
    return json.dumps({"outcome": outcome, "reason": reason})


# ---------- deployment / views ----------


def test_deploy_sets_program_info(direct_vm, direct_deploy, direct_owner):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    info = contract.get_program_info()
    assert info["maintainer"] == as_hex(direct_owner)
    assert info["repo_issues_url"] == ISSUES_URL
    assert info["scope_description"] == SCOPE
    assert info["min_bond"] == 100
    assert info["pool_balance"] == 0
    assert info["report_count"] == 0


def test_get_report_missing_reverts(direct_vm, direct_deploy, direct_owner):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.expect_revert("report not found"):
        contract.get_report(999)


# ---------- funding ----------


def test_fund_pool_increases_balance(direct_vm, direct_deploy, direct_owner):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    direct_vm.value = 500
    contract.fund_pool()
    direct_vm.value = 0
    assert contract.get_pool_balance() == 500


def test_fund_pool_zero_value_reverts(direct_vm, direct_deploy, direct_owner):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    direct_vm.value = 0
    with direct_vm.expect_revert("EXPECTED"):
        contract.fund_pool()


# ---------- submit_report ----------


def test_submit_report_succeeds_and_is_readable(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("XSS in login", "details here", "https://evidence")
        direct_vm.value = 0

    report = contract.get_report(report_id)
    assert report["reporter"] == as_hex(direct_alice)
    assert report["title"] == "XSS in login"
    assert report["status"] == "submitted"
    assert report["bond"] == 100
    assert report["created_at"]


def test_submit_report_below_min_bond_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner, min_bond=100)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 99
        with direct_vm.expect_revert("EXPECTED"):
            contract.submit_report("t", "d", "")
        direct_vm.value = 0


def test_submit_report_exactly_min_bond_succeeds(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner, min_bond=100)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0
    assert contract.get_report(report_id)["bond"] == 100


def test_submit_report_empty_title_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        with direct_vm.expect_revert("EXPECTED"):
            contract.submit_report("   ", "d", "")
        direct_vm.value = 0


def test_submit_report_empty_description_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        with direct_vm.expect_revert("EXPECTED"):
            contract.submit_report("t", "   ", "")
        direct_vm.value = 0


def test_report_count_and_list_ids(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        id1 = contract.submit_report("t1", "d1", "")
        direct_vm.value = 0
    with direct_vm.prank(direct_bob):
        direct_vm.value = 100
        id2 = contract.submit_report("t2", "d2", "")
        direct_vm.value = 0

    assert contract.get_report_count() == 2
    assert sorted(contract.list_report_ids()) == sorted([id1, id2])


# ---------- withdraw_unresolved ----------


def test_withdraw_unresolved_refunds_reporter(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0
        contract.withdraw_unresolved(report_id)

    report = contract.get_report(report_id)
    assert report["status"] == "withdrawn"
    assert report["bond"] == 0


def test_withdraw_unresolved_by_non_reporter_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0

    with direct_vm.prank(direct_bob):
        with direct_vm.expect_revert("EXPECTED"):
            contract.withdraw_unresolved(report_id)


def test_withdraw_unresolved_after_dispute_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0

    with direct_vm.prank(direct_owner):
        contract.dispute_report(report_id)

    with direct_vm.prank(direct_alice):
        with direct_vm.expect_revert("EXPECTED"):
            contract.withdraw_unresolved(report_id)


# ---------- accept_report ----------


def test_accept_report_pays_bond_plus_bounty_and_drains_pool(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    direct_vm.value = 1000
    contract.fund_pool()
    direct_vm.value = 0

    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0

    with direct_vm.prank(direct_owner):
        contract.accept_report(report_id, 300)

    report = contract.get_report(report_id)
    assert report["status"] == "valid"
    assert report["bond"] == 0
    assert contract.get_pool_balance() == 700


def test_accept_report_by_non_maintainer_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0
        with direct_vm.expect_revert("EXPECTED"):
            contract.accept_report(report_id, 0)


def test_accept_report_bounty_exceeds_pool_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0

    with direct_vm.prank(direct_owner):
        with direct_vm.expect_revert("EXPECTED"):
            contract.accept_report(report_id, 50)


def test_accept_report_on_non_pending_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0
        contract.withdraw_unresolved(report_id)

    with direct_vm.prank(direct_owner):
        with direct_vm.expect_revert("EXPECTED"):
            contract.accept_report(report_id, 0)


# ---------- dispute_report ----------


def test_dispute_report_moves_to_disputed(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0

    with direct_vm.prank(direct_owner):
        contract.dispute_report(report_id)

    assert contract.get_report(report_id)["status"] == "disputed"


def test_dispute_report_by_non_maintainer_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0
        with direct_vm.expect_revert("EXPECTED"):
            contract.dispute_report(report_id)


def test_dispute_report_on_non_pending_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0

    with direct_vm.prank(direct_owner):
        contract.dispute_report(report_id)
        with direct_vm.expect_revert("EXPECTED"):
            contract.dispute_report(report_id)


# ---------- resolve_dispute: the nondet round ----------


def _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice, bond=100):
    with direct_vm.prank(direct_alice):
        direct_vm.value = bond
        report_id = contract.submit_report("SQLi in search", "full details", "https://poc")
        direct_vm.value = 0
    with direct_vm.prank(direct_owner):
        contract.dispute_report(report_id)
    return report_id


def test_resolve_dispute_valid_pays_bond_plus_bounty(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_charlie
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    direct_vm.value = 1000
    contract.fund_pool()
    direct_vm.value = 0

    report_id = _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice)

    direct_vm.mock_web(r"api\.github\.com", {"method": "GET", "status": 200, "body": "[]"})
    direct_vm.mock_llm(PROMPT_MARKER, llm_response("valid", "real in-scope bug"))

    with direct_vm.prank(direct_charlie):
        contract.resolve_dispute(report_id, 250)

    report = contract.get_report(report_id)
    assert report["status"] == "valid"
    assert report["bond"] == 0
    assert report["verdict_reason"] == "real in-scope bug"
    assert contract.get_pool_balance() == 750


def test_resolve_dispute_duplicate_refunds_bond_only(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    direct_vm.value = 1000
    contract.fund_pool()
    direct_vm.value = 0

    report_id = _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice)

    direct_vm.mock_web(r"api\.github\.com", {"method": "GET", "status": 200, "body": "[]"})
    direct_vm.mock_llm(PROMPT_MARKER, llm_response("duplicate", "already reported"))

    contract.resolve_dispute(report_id, 250)

    report = contract.get_report(report_id)
    assert report["status"] == "duplicate"
    assert report["bond"] == 0
    assert contract.get_pool_balance() == 1000  # bounty never taken


def test_resolve_dispute_invalid_keeps_bond_in_pool(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    direct_vm.value = 1000
    contract.fund_pool()
    direct_vm.value = 0

    report_id = _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice, bond=100)

    direct_vm.mock_web(r"api\.github\.com", {"method": "GET", "status": 200, "body": "[]"})
    direct_vm.mock_llm(PROMPT_MARKER, llm_response("invalid", "not a real bug"))

    contract.resolve_dispute(report_id, 250)

    report = contract.get_report(report_id)
    assert report["status"] == "invalid"
    assert report["bond"] == 0
    # bond (100) added to pool, no bounty paid out
    assert contract.get_pool_balance() == 1100


def test_resolve_dispute_insufficient_evidence_abstains_and_refunds(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    report_id = _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice)

    direct_vm.mock_web(r"api\.github\.com", {"method": "GET", "status": 200, "body": "[]"})
    direct_vm.mock_llm(PROMPT_MARKER, llm_response("insufficient_evidence", "page empty"))

    contract.resolve_dispute(report_id, 0)

    report = contract.get_report(report_id)
    assert report["status"] == "unresolved"
    assert report["bond"] == 0


def test_resolve_dispute_malformed_llm_output_abstains(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    """A non-JSON model reply must never crash the contract or silently mutate state as valid."""
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    report_id = _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice)

    direct_vm.mock_web(r"api\.github\.com", {"method": "GET", "status": 200, "body": "[]"})
    direct_vm.mock_llm(PROMPT_MARKER, "I cannot comply with this request.")

    contract.resolve_dispute(report_id, 0)

    report = contract.get_report(report_id)
    assert report["status"] == "unresolved"
    assert "LLM_ERROR" in report["verdict_reason"]


def test_resolve_dispute_llm_output_with_invalid_outcome_value_abstains(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    report_id = _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice)

    direct_vm.mock_web(r"api\.github\.com", {"method": "GET", "status": 200, "body": "[]"})
    direct_vm.mock_llm(PROMPT_MARKER, json.dumps({"outcome": "definitely-yes", "reason": "x"}))

    contract.resolve_dispute(report_id, 0)

    assert contract.get_report(report_id)["status"] == "unresolved"


def test_resolve_dispute_fenced_json_is_parsed(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    direct_vm.value = 1000
    contract.fund_pool()
    direct_vm.value = 0
    report_id = _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice)

    direct_vm.mock_web(r"api\.github\.com", {"method": "GET", "status": 200, "body": "[]"})
    direct_vm.mock_llm(
        PROMPT_MARKER,
        "```json\n" + llm_response("valid", "fenced but parsable") + "\n```",
    )

    contract.resolve_dispute(report_id, 100)

    assert contract.get_report(report_id)["status"] == "valid"


def test_resolve_dispute_survives_web_fetch_failure(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    """No mock registered for the issues URL -> fetch raises -> contract must not crash."""
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    report_id = _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice)

    direct_vm.mock_llm(PROMPT_MARKER, llm_response("insufficient_evidence", "no issues data"))

    contract.resolve_dispute(report_id, 0)

    report = contract.get_report(report_id)
    assert report["status"] == "unresolved"


def test_resolve_dispute_is_permissionless(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_charlie
):
    """A third party who is neither reporter nor maintainer can trigger resolution."""
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    report_id = _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice)

    direct_vm.mock_web(r"api\.github\.com", {"method": "GET", "status": 200, "body": "[]"})
    direct_vm.mock_llm(PROMPT_MARKER, llm_response("duplicate"))

    with direct_vm.prank(direct_charlie):
        contract.resolve_dispute(report_id, 0)

    assert contract.get_report(report_id)["status"] == "duplicate"


def test_resolve_dispute_not_disputed_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report("t", "d", "")
        direct_vm.value = 0

    with direct_vm.expect_revert("EXPECTED"):
        contract.resolve_dispute(report_id, 0)


def test_resolve_dispute_bounty_exceeds_pool_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    report_id = _submit_and_dispute(direct_vm, contract, direct_owner, direct_alice)

    with direct_vm.expect_revert("EXPECTED"):
        contract.resolve_dispute(report_id, 999999)


def test_resolve_dispute_reads_evidence_url_when_present(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    """evidence_url is only fetched when the reporter supplied one."""
    contract = deploy(direct_vm, direct_deploy, direct_owner)
    with direct_vm.prank(direct_alice):
        direct_vm.value = 100
        report_id = contract.submit_report(
            "t", "d", "https://gist.githubusercontent.com/example/poc"
        )
        direct_vm.value = 0
    with direct_vm.prank(direct_owner):
        contract.dispute_report(report_id)

    direct_vm.mock_web(r"api\.github\.com", {"method": "GET", "status": 200, "body": "[]"})
    direct_vm.mock_web(
        r"gist\.githubusercontent\.com", {"method": "GET", "status": 200, "body": "PoC script"}
    )
    direct_vm.mock_llm(PROMPT_MARKER, llm_response("valid", "matches PoC"))

    contract.resolve_dispute(report_id, 0)
    assert contract.get_report(report_id)["status"] == "valid"


# ---------- constructor coercion ----------


def test_constructor_coerces_string_maintainer_address(
    direct_vm, direct_deploy, direct_owner
):
    # A module only tolerates one Contract class load per test (gltest's
    # loader enforces "one contract per module"), so derive the expected
    # hex without a prior deploy call in this same test.
    direct_vm.sender = direct_owner
    owner_hex = "0x" + direct_owner.hex()

    contract = direct_deploy(CONTRACT_PATH, owner_hex, ISSUES_URL, SCOPE, 50)
    assert contract.get_maintainer().lower() == owner_hex.lower()
