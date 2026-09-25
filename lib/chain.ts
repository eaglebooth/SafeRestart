"use client";
import { createClient } from "genlayer-js";
import { chain } from "./network";

export type Encodable = null | boolean | number | bigint | string | Uint8Array | Encodable[] | Map<string, Encodable> | { [key: string]: Encodable };
type Provider = { request: (input: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global { interface Window { ethereum?: Provider } }
type Receipt = { vote?: string; execution_result?: string };
type Tx = { statusName?: string; resultName?: string; txExecutionResultName?: string; consensus_data?: { leader_receipt?: Receipt[] } };
type Runtime = {
  readContract: (input: { address: `0x${string}`; functionName: string; args: Encodable[] }) => Promise<Encodable>;
  writeContract: (input: { address: `0x${string}`; functionName: string; args: Encodable[]; value: bigint }) => Promise<string>;
  waitForTransactionReceipt: (input: { hash: `0x${string}`; status: "FINALIZED"; interval: number; retries: number }) => Promise<Tx>;
};

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask is required");
  const id = `0x${chain.id.toString(16)}`;
  try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: id }] }); }
  catch { /* GenLayer client will request the configured chain during write if it is not yet registered. */ }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
  return accounts[0] || "";
}

export async function readContract(address: string, method: string, args: Encodable[] = []): Promise<Record<string, unknown>> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("Enter a valid deployed contract address");
  const client = createClient({ chain }) as unknown as Runtime;
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await client.readContract({ address: address as `0x${string}`, functionName: method, args });
      return JSON.parse(String(result)) as Record<string, unknown>;
    } catch (error) {
      last = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? last : new Error("Studionet read failed");
}

export async function writeContract(address: string, account: string, method: string, args: Encodable[], onStatus: (state: string, hash?: string) => void): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask is required");
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("Enter a valid contract address");
  const client = createClient({ chain, provider: window.ethereum, account: account as `0x${string}` }) as unknown as Runtime;
  onStatus("SIGNATURE");
  const hash = await client.writeContract({ address: address as `0x${string}`, functionName: method, args, value: BigInt(0) });
  onStatus("CONSENSUS", hash);
  const tx = await client.waitForTransactionReceipt({ hash: hash as `0x${string}`, status: "FINALIZED", interval: 2500, retries: 360 });
  const leaders = tx.consensus_data?.leader_receipt || [];
  const agreed = ["AGREE", "MAJORITY_AGREE"].includes(String(tx.resultName || "").toUpperCase()) || leaders.some(r => String(r.vote || "").toUpperCase() === "AGREE");
  const explicitError = ["FINISHED_WITH_ERROR", "ERROR"].includes(String(tx.txExecutionResultName || "").toUpperCase()) || leaders.some(r => String(r.execution_result || "").toUpperCase().includes("ERROR"));
  if (tx.statusName !== "FINALIZED" || !agreed || explicitError) throw new Error(`Finalized without a successful agreed execution (${tx.resultName || "unknown"}/${tx.txExecutionResultName || "unavailable"})`);
  onStatus("VERIFYING", hash);
  return hash;
}
