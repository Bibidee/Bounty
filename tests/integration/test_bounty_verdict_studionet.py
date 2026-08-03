"""Integration tests against real GenLayer consensus (StudioNet).

Run with:
    gltest tests/integration -v -s --network studionet

These exercise the full transaction lifecycle including the nondet
dispute-resolution round, so each test can take 1-4+ minutes.
"""

from gltest import get_contract_factory, get_default_account, create_accounts
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded

SCOPE = "Any remote code execution or authentication bypass in the main branch."
ISSUES_URL = "https://api.github.com/repos/octocat/Hello-World/issues"
MIN_BOND = 10


def deploy_contract():
    factory = get_contract_factory("BountyVerdict")
    owner = get_default_account()
    contract = factory.deploy(
        args=[owner.address, ISSUES_URL, SCOPE, MIN_BOND],
        wait_interval=5000,
        wait_retries=60,
    )

    info = contract.get_program_info(args=[])
    assert info["maintainer"].lower() == owner.address.lower()
    assert info["pool_balance"] == 0
    assert info["report_count"] == 0
    return contract


def test_deploy_and_fund_pool():
    contract = load_fixture(deploy_contract)

    fund_result = contract.fund_pool(
        args=[],
        value=1000,
        wait_interval=5000,
        wait_retries=60,
    )
    assert tx_execution_succeeded(fund_result)

    info = contract.get_program_info(args=[])
    assert info["pool_balance"] == 1000


def test_submit_and_accept_report_full_lifecycle():
    contract = load_fixture(deploy_contract)
    [reporter] = create_accounts(1)

    fund_result = contract.fund_pool(
        args=[],
        value=2000,
        wait_interval=5000,
        wait_retries=60,
    )
    assert tx_execution_succeeded(fund_result)

    submit_result = contract.submit_report(
        args=["Insecure default config", "Detailed writeup of the issue.", ""],
        value=MIN_BOND,
        account=reporter,
        wait_interval=5000,
        wait_retries=60,
    )
    assert tx_execution_succeeded(submit_result)

    report_ids = contract.list_report_ids(args=[])
    assert len(report_ids) == 1
    report_id = report_ids[0]

    report = contract.get_report(args=[report_id])
    assert report["status"] == "submitted"
    assert report["bond"] == MIN_BOND

    accept_result = contract.accept_report(
        args=[report_id, 500],
        wait_interval=5000,
        wait_retries=60,
    )
    assert tx_execution_succeeded(accept_result)

    report = contract.get_report(args=[report_id])
    assert report["status"] == "valid"
    assert report["bond"] == 0

    info = contract.get_program_info(args=[])
    assert info["pool_balance"] == 2000 - 500


def test_submit_withdraw_unresolved():
    contract = load_fixture(deploy_contract)
    [reporter] = create_accounts(1)

    submit_result = contract.submit_report(
        args=["Minor issue", "Not a big deal", ""],
        value=MIN_BOND,
        account=reporter,
        wait_interval=5000,
        wait_retries=60,
    )
    assert tx_execution_succeeded(submit_result)

    report_id = contract.list_report_ids(args=[])[0]

    withdraw_result = contract.withdraw_unresolved(
        args=[report_id],
        account=reporter,
        wait_interval=5000,
        wait_retries=60,
    )
    assert tx_execution_succeeded(withdraw_result)

    report = contract.get_report(args=[report_id])
    assert report["status"] == "withdrawn"
    assert report["bond"] == 0


def test_dispute_and_resolve_real_consensus():
    """The one test that actually exercises the nondet round: fetches the
    real issues URL, runs the LLM judgment through prompt_comparative, and
    settles on-chain. This is the slowest test in the suite."""
    contract = load_fixture(deploy_contract)
    [reporter] = create_accounts(1)

    fund_result = contract.fund_pool(
        args=[],
        value=1000,
        wait_interval=5000,
        wait_retries=60,
    )
    assert tx_execution_succeeded(fund_result)

    submit_result = contract.submit_report(
        args=[
            "Clearly out of scope report",
            "This report is unrelated to any security vulnerability and just "
            "asks the maintainer to change the README wording.",
            "",
        ],
        value=MIN_BOND,
        account=reporter,
        wait_interval=5000,
        wait_retries=60,
    )
    assert tx_execution_succeeded(submit_result)

    report_id = contract.list_report_ids(args=[])[0]

    dispute_result = contract.dispute_report(
        args=[report_id],
        wait_interval=5000,
        wait_retries=60,
    )
    assert tx_execution_succeeded(dispute_result)

    assert contract.get_report(args=[report_id])["status"] == "disputed"

    resolve_result = contract.resolve_dispute(
        args=[report_id, 100],
        wait_interval=8000,
        wait_retries=90,
    )
    assert tx_execution_succeeded(resolve_result)

    report = contract.get_report(args=[report_id])
    assert report["status"] in ("valid", "invalid", "duplicate", "unresolved")
    assert report["bond"] == 0
    assert report["resolved_at"]
    print(f"\nStudioNet verdict for out-of-scope report: {report['status']!r}")
    print(f"Reason: {report['verdict_reason']!r}")
