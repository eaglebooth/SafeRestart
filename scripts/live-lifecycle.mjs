import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const address = process.env.CONTRACT_ADDRESS;
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const key = (name) => {
  const value = required(name);
  return value.startsWith("0x") ? value : `0x${value}`;
};
if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) throw new Error("Invalid CONTRACT_ADDRESS");

const walletA = createAccount(key("ROLE_A_SIGNER"));
const walletB = createAccount(key("ROLE_B_SIGNER"));
const clients = {
  a: createClient({ chain: studionet, account: walletA }),
  b: createClient({ chain: studionet, account: walletB }),
};
const caseId = required("CASE_ID");
const assetId = required("ASSET_ID");
const incidentDigest = required("INCIDENT_DIGEST");
const restartDigest = required("RESTART_DIGEST");
const policy = [required("POLICY_REPOSITORY"), required("POLICY_URL"), required("POLICY_SHA256"), BigInt(required("POLICY_BYTES"))];
const technician = [required("TECHNICIAN_REPOSITORY"), required("TECHNICIAN_URL"), required("TECHNICIAN_SHA256"), BigInt(required("TECHNICIAN_BYTES"))];
const inspector = [required("INSPECTOR_REPOSITORY"), required("INSPECTOR_URL"), required("INSPECTOR_SHA256"), BigInt(required("INSPECTOR_BYTES"))];

const read = async (method, args = []) => JSON.parse(await clients.a.readContract({ address, functionName: method, args }));
const retry = async (operation, attempts = 5) => {
  let cause;
  for (let index = 0; index < attempts; index++) {
    try { return await operation(); }
    catch (error) {
      cause = error;
      if (index < attempts - 1) await new Promise(resolve => setTimeout(resolve, 1500 * (index + 1)));
    }
  }
  throw cause;
};
const transact = async (label, client, method, args, expectSuccess = true) => {
  const hash = await client.writeContract({ address, functionName: method, args, value: 0n });
  console.log(JSON.stringify({ label, hash, phase: "submitted" }));
  const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, interval: 2500, retries: 360 });
  const tx = await retry(() => client.getTransaction({ hash }));
  const leader = tx.consensus_data?.leader_receipt?.[0];
  const result = tx.result_name ?? tx.resultName ?? receipt.resultName ?? "";
  const execution = leader?.execution_result ?? tx.txExecutionResultName ?? receipt.txExecutionResultName ?? "";
  const success = (tx.statusName ?? receipt.statusName) === "FINALIZED"
    && ["MAJORITY_AGREE", "AGREE"].includes(result)
    && ["SUCCESS", "FINISHED_WITH_RETURN"].includes(execution);
  console.log(JSON.stringify({ label, hash, result, execution, expected: expectSuccess ? "SUCCESS" : "REVERT", observed: success ? "SUCCESS" : "REVERT" }));
  if (success !== expectSuccess) throw new Error(`${label}: unexpected outcome`);
  return hash;
};

const controller = walletA.address;
console.log(JSON.stringify({ address, controller, technician: walletA.address, inspector: walletB.address, operator: walletB.address, before: await read("get_stats") }, null, 2));

await transact("create_case", clients.a, "create_case", [caseId, assetId, walletA.address, walletB.address, walletB.address,
  policy[0], policy[1], policy[2], policy[3], incidentDigest, restartDigest, technician[0], inspector[0]]);
await transact("wrong_actor_technician_rejected", clients.b, "submit_technician_evidence", [controller, caseId, technician[1], technician[2], technician[3]], false);
await transact("technician_evidence", clients.a, "submit_technician_evidence", [controller, caseId, technician[1], technician[2], technician[3]]);
await transact("early_restart_rejected", clients.b, "consume_restart", [controller, caseId, restartDigest, "early-restart"], false);
await transact("inspector_evidence", clients.b, "submit_inspector_evidence", [controller, caseId, inspector[1], inspector[2], inspector[3]]);
await transact("assessment", clients.b, "assess", [controller, caseId]);
let state = await read("get_case", [controller, caseId]);
if (state.status !== "CLEARED") throw new Error(`Expected CLEARED, received ${state.status}`);
await transact("wrong_operator_rejected", clients.a, "consume_restart", [controller, caseId, restartDigest, "wrong-operator"], false);
await transact("restart_consumed", clients.b, "consume_restart", [controller, caseId, restartDigest, "restart-pump-17"]);
await transact("double_consume_rejected", clients.b, "consume_restart", [controller, caseId, restartDigest, "restart-again"], false);
state = await read("get_case", [controller, caseId]);
console.log(JSON.stringify({ final: state, stats: await read("get_stats") }, null, 2));
