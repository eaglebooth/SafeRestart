import hashlib, json
from pathlib import Path
import pytest

def addr(raw): return "0x" + bytes(raw).hex()
def digest(text): return hashlib.sha256(text.encode()).hexdigest()

COMMIT = "1" * 40
POLICY = """# Restart policy
case_id=restart-001
asset_id=pump-17
incident_digest={incident}
Mandatory: guard installed; pressure <= 8 bar; vibration <= 4 mm/s; emergency stop tested; regression complete; rollback tested.
"""
TECH = """# Technician report
case_id=restart-001
asset_id=pump-17
incident_digest={incident}
Guard installed. Pressure 6.2 bar. Vibration 2.1 mm/s. Emergency stop, regression and rollback tests passed.
"""
INSPECT = """# Independent inspection
case_id=restart-001
asset_id=pump-17
incident_digest={incident}
Independently witnessed guard, 6.2 bar, 2.1 mm/s, emergency stop, regression and rollback. All pass.
"""
INCIDENT = "a" * 64
RESTART = "b" * 64

def url(repo, name): return f"https://raw.githubusercontent.com/{repo}/{COMMIT}/{name}.md"

def create(contract, owner, alice, bob):
    policy = POLICY.format(incident=INCIDENT)
    contract.create_case("restart-001", "pump-17", addr(alice), addr(bob), addr(bob),
        "plant/policy", url("plant/policy", "POLICY"), digest(policy), len(policy.encode()),
        INCIDENT, RESTART, "technician/report", "inspector/report")

def submit(contract, vm, owner, alice, bob):
    tech, inspect = TECH.format(incident=INCIDENT), INSPECT.format(incident=INCIDENT)
    with vm.prank(alice):
        contract.submit_technician_evidence(addr(owner), "restart-001", url("technician/report", "TECH"), digest(tech), len(tech.encode()))
    with vm.prank(bob):
        contract.submit_inspector_evidence(addr(owner), "restart-001", url("inspector/report", "INSPECT"), digest(inspect), len(inspect.encode()))

def mocks(vm, verdict="CLEARED"):
    policy, tech, inspect = POLICY.format(incident=INCIDENT), TECH.format(incident=INCIDENT), INSPECT.format(incident=INCIDENT)
    vm.mock_web(r"POLICY.md", {"method":"GET", "status":200, "body":policy})
    vm.mock_web(r"TECH.md", {"method":"GET", "status":200, "body":tech})
    vm.mock_web(r"INSPECT.md", {"method":"GET", "status":200, "body":inspect})
    vm.mock_llm(r"EXPECTED case_id=restart-001; asset_id=pump-17", json.dumps({"verdict":verdict}))

def test_schema_loads(direct_deploy):
    contract = direct_deploy("contracts/safe_restart.py")
    assert json.loads(contract.get_stats()) == {"case_count": 0, "execution_count": 0}

def test_release_fixtures_bind_exact_case_asset_and_incident():
    root = Path(__file__).parents[1] / "fixtures"
    for name in ("RESTART_POLICY.md", "TECHNICIAN_REPORT.md", "INSPECTION_REPORT.md"):
        raw = (root / name).read_bytes()
        text = raw.decode("utf-8")
        assert "restart-001" in text and "pump-17" in text and INCIDENT in text
        assert digest(text) == hashlib.sha256(raw).hexdigest()
        assert 0 < len(raw) <= 24000

def test_deployer_has_no_implicit_role(direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    contract = direct_deploy("contracts/safe_restart.py")
    with direct_vm.prank(direct_alice): create(contract, direct_alice, direct_alice, direct_bob)
    with direct_vm.expect_revert("OPERATOR_ONLY"):
        contract.consume_restart(addr(direct_alice), "restart-001", RESTART, "owner-attempt")

def test_independent_roles_required(direct_deploy, direct_vm, direct_owner, direct_alice):
    contract = direct_deploy("contracts/safe_restart.py")
    policy = POLICY.format(incident=INCIDENT)
    with direct_vm.expect_revert("INSPECTION_NOT_INDEPENDENT"):
        contract.create_case("restart-001", "pump-17", addr(direct_alice), addr(direct_alice), addr(direct_alice),
            "plant/policy", url("plant/policy", "POLICY"), digest(policy), len(policy.encode()),
            INCIDENT, RESTART, "technician/report", "inspector/report")

def test_happy_path_and_one_time_permit(direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    contract = direct_deploy("contracts/safe_restart.py")
    create(contract, direct_owner, direct_alice, direct_bob)
    submit(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    mocks(direct_vm)
    assert contract.assess(addr(direct_owner), "restart-001") == "CLEARED"
    with direct_vm.prank(direct_bob):
        receipt = contract.consume_restart(addr(direct_owner), "restart-001", RESTART, "restart-pump-17")
    state = json.loads(contract.get_case(addr(direct_owner), "restart-001"))
    assert state["status"] == "PERMIT_CONSUMED" and state["receipt"] == receipt
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("CASE_NOT_CLEARED"):
        contract.consume_restart(addr(direct_owner), "restart-001", RESTART, "replay")

def test_wrong_actor_cannot_submit_or_operate(direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    contract = direct_deploy("contracts/safe_restart.py")
    create(contract, direct_owner, direct_alice, direct_bob)
    tech = TECH.format(incident=INCIDENT)
    before = contract.get_case(addr(direct_owner), "restart-001")
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("TECHNICIAN_ONLY"):
        contract.submit_technician_evidence(addr(direct_owner), "restart-001", url("technician/report", "TECH"), digest(tech), len(tech.encode()))
    assert contract.get_case(addr(direct_owner), "restart-001") == before
    with direct_vm.prank(direct_alice), direct_vm.expect_revert("OPERATOR_ONLY"):
        contract.consume_restart(addr(direct_owner), "restart-001", RESTART, "wrong-actor")

@pytest.mark.parametrize("verdict", ["BLOCKED", "CONFLICTED", "INSUFFICIENT_EVIDENCE"])
def test_non_clearing_verdict_never_authorizes(verdict, direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    contract = direct_deploy("contracts/safe_restart.py")
    create(contract, direct_owner, direct_alice, direct_bob)
    submit(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    mocks(direct_vm, verdict)
    assert contract.assess(addr(direct_owner), "restart-001") == verdict
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("CASE_NOT_CLEARED"):
        contract.consume_restart(addr(direct_owner), "restart-001", RESTART, "blocked")

def test_digest_mismatch_yields_insufficient_evidence(direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    contract = direct_deploy("contracts/safe_restart.py")
    create(contract, direct_owner, direct_alice, direct_bob)
    tech, inspect = TECH.format(incident=INCIDENT), INSPECT.format(incident=INCIDENT)
    with direct_vm.prank(direct_alice):
        contract.submit_technician_evidence(addr(direct_owner), "restart-001", url("technician/report", "TECH"), "c" * 64, len(tech.encode()))
    with direct_vm.prank(direct_bob):
        contract.submit_inspector_evidence(addr(direct_owner), "restart-001", url("inspector/report", "INSPECT"), digest(inspect), len(inspect.encode()))
    mocks(direct_vm)
    assert contract.assess(addr(direct_owner), "restart-001") == "INSUFFICIENT_EVIDENCE"

def test_unassigned_observer_cannot_force_assessment(direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    contract = direct_deploy("contracts/safe_restart.py")
    with direct_vm.prank(direct_alice):
        create(contract, direct_alice, direct_alice, direct_bob)
    submit(contract, direct_vm, direct_alice, direct_alice, direct_bob)
    with direct_vm.expect_revert("ASSIGNED_ROLE_ONLY"):
        contract.assess(addr(direct_alice), "restart-001")

def test_repository_and_commit_are_enforced(direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    contract = direct_deploy("contracts/safe_restart.py")
    create(contract, direct_owner, direct_alice, direct_bob)
    tech = TECH.format(incident=INCIDENT)
    with direct_vm.prank(direct_alice):
        with direct_vm.expect_revert("INVALID_TECHNICIAN_URL"):
            contract.submit_technician_evidence(addr(direct_owner), "restart-001", url("attacker/repo", "TECH"), digest(tech), len(tech.encode()))
        with direct_vm.expect_revert("INVALID_TECHNICIAN_URL"):
            contract.submit_technician_evidence(addr(direct_owner), "restart-001", "https://raw.githubusercontent.com/technician/report/main/TECH.md", digest(tech), len(tech.encode()))
