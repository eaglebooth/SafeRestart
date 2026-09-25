"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Check, CircleAlert, ClipboardCheck, Gauge, Link2, LockKeyhole, Power, Radio, ShieldCheck, Wallet } from "lucide-react";
import { connectWallet, readContract, writeContract, type Encodable } from "@/lib/chain";
import { defaultContract, explorer } from "@/lib/network";

type CaseState = Record<string, unknown>;
type Form = Record<string, string>;
const A = "0xeb57bc7125fa60d7482CE12058397369AB3581f8";
const B = "0x2da5393d7BBb9A037dc3abB56DbbC5C150fc843f";
const initial: Form = {
  controller: A, caseId: "restart-001", assetId: "pump-17", technician: A, inspector: B, operator: B,
  policyRepository: "your-org/saferestart-policy", policyUrl: "", policyHash: "", policyBytes: "",
  incidentDigest: "", restartDigest: "", technicianRepository: "your-org/technician-report",
  inspectorRepository: "your-org/inspection-report", evidenceUrl: "", evidenceHash: "", evidenceBytes: "", operationId: "restart-pump-17"
};

const phases = ["LOCKED", "EVIDENCE_OPEN", "READY_FOR_REVIEW", "CLEARED", "PERMIT_CONSUMED"];
const short = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";

export default function Home() {
  const [contract, setContract] = useState(defaultContract());
  const [account, setAccount] = useState("");
  const [form, setForm] = useState<Form>(initial);
  const [state, setState] = useState<CaseState | null>(null);
  const [mode, setMode] = useState<"create" | "technician" | "inspector" | "assess" | "consume">("create");
  const [txState, setTxState] = useState("IDLE");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const set = (key: string, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const status = String(state?.status || "NOT SYNCED");
  const role = useMemo(() => {
    const who = account.toLowerCase();
    if (!who) return "DISCONNECTED";
    if (who === String(state?.technician || form.technician).toLowerCase()) return "TECHNICIAN";
    if (who === String(state?.inspector || form.inspector).toLowerCase()) return "INSPECTOR / OPERATOR";
    if (who === String(state?.controller || form.controller).toLowerCase()) return "CONTROLLER";
    return "OBSERVER";
  }, [account, state, form]);
  const actionGate = useMemo(() => {
    if (!account) return { allowed: false, reason: "Connect a funded Studionet role wallet" };
    if (mode === "create") return { allowed: true, reason: "Connected sender becomes case controller" };
    if (!state) return { allowed: false, reason: "Sync the on-chain case before writing" };
    const who = account.toLowerCase();
    const current = String(state.status || "");
    const assigned = [state.controller, state.technician, state.inspector, state.operator].map(String).map(value => value.toLowerCase());
    if (mode === "technician") return who === String(state.technician).toLowerCase() && ["LOCKED", "EVIDENCE_OPEN"].includes(current)
      ? { allowed: true, reason: "Authorized technician evidence phase" } : { allowed: false, reason: "Requires assigned technician during evidence phase" };
    if (mode === "inspector") return who === String(state.inspector).toLowerCase() && ["LOCKED", "EVIDENCE_OPEN"].includes(current)
      ? { allowed: true, reason: "Authorized independent inspection phase" } : { allowed: false, reason: "Requires assigned inspector during evidence phase" };
    if (mode === "assess") return assigned.includes(who) && current === "READY_FOR_REVIEW"
      ? { allowed: true, reason: "Assigned role may start review" } : { allowed: false, reason: "Requires assigned role and READY FOR REVIEW" };
    return who === String(state.operator).toLowerCase() && current === "CLEARED"
      ? { allowed: true, reason: "Cleared one-time operator capability" } : { allowed: false, reason: "Requires assigned operator and CLEARED verdict" };
  }, [account, mode, state]);

  async function sync() {
    setError(""); setTxState("READING");
    try { setState(await readContract(contract, "get_case", [form.controller, form.caseId])); setTxState("SYNCED"); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setTxState("ERROR"); }
  }

  async function submit() {
    setError("");
    if (!actionGate.allowed) { setError(actionGate.reason); return; }
    let method = ""; let args: Encodable[] = [];
    if (mode === "create") {
      method = "create_case";
      args = [form.caseId, form.assetId, form.technician, form.inspector, form.operator, form.policyRepository,
        form.policyUrl, form.policyHash, BigInt(form.policyBytes || 0), form.incidentDigest, form.restartDigest,
        form.technicianRepository, form.inspectorRepository];
    } else if (mode === "technician" || mode === "inspector") {
      method = mode === "technician" ? "submit_technician_evidence" : "submit_inspector_evidence";
      args = [form.controller, form.caseId, form.evidenceUrl, form.evidenceHash, BigInt(form.evidenceBytes || 0)];
    } else if (mode === "assess") {
      method = "assess"; args = [form.controller, form.caseId];
    } else {
      method = "consume_restart"; args = [form.controller, form.caseId, form.restartDigest, form.operationId];
    }
    try {
      const hash = await writeContract(contract, account, method, args, (next, h) => { setTxState(next); if (h) setTxHash(h); });
      setTxHash(hash);
      const fresh = await readContract(contract, "get_case", [mode === "create" ? account : form.controller, form.caseId]);
      setState(fresh); if (mode === "create") set("controller", account); setTxState("VERIFIED");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setTxState("ERROR"); }
  }

  const modeLabel = { create: "Register lockout", technician: "File repair report", inspector: "File inspection", assess: "Run AI safety review", consume: "Consume restart permit" }[mode];
  return <main>
    <header className="topbar">
      <div className="brand"><Image src="/saferestart-logo.png" alt="SafeRestart" width={48} height={48} priority/><div><strong>SAFERESTART</strong><span>GENLAYER EQUIPMENT CLEARANCE</span></div></div>
      <div className="network"><Radio size={14}/> STUDIONET <b>61999</b></div>
      <button className="wallet" onClick={async () => { try { setAccount(await connectWallet()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}><Wallet size={17}/>{account ? short(account) : "CONNECT ROLE WALLET"}</button>
    </header>

    <section className="hero">
      <div className="hero-copy"><span className="eyebrow">01 / MACHINE SAFETY GATE</span><h1>Restart only when<br/><em>the evidence agrees.</em></h1><p>Independent technician and inspector records become a one-time restart permit—evaluated by GenLayer, enforced by sender identity.</p></div>
      <div className="hero-machine"><Image src="/saferestart-logo.png" alt="Equipment restart mark" width={460} height={460} priority/><div className="permit-stamp"><ShieldCheck/><span>AUTHORITY<br/>ON-CHAIN</span></div></div>
    </section>

    <section className="console">
      <aside className="rail">
        <span className="section-tag">LIVE CASE RAIL</span>
        <div className="case-search"><label>CONTRACT</label><input value={contract} onChange={e => setContract(e.target.value)} placeholder="0x…"/><label>CONTROLLER</label><input value={form.controller} onChange={e => set("controller", e.target.value)}/><label>CASE ID</label><div className="inline"><input value={form.caseId} onChange={e => set("caseId", e.target.value)}/><button onClick={sync}>SYNC</button></div></div>
        <div className="lifecycle">{phases.map((phase, index) => { const current = phases.indexOf(status); const active = current >= index || status === phase; return <div className={`phase ${active ? "active" : ""}`} key={phase}><i>{active ? <Check size={13}/> : index + 1}</i><span>{phase.replaceAll("_", " ")}</span></div>; })}</div>
        <div className="source-note"><LockKeyhole size={18}/><p><b>Markdown never grants authority.</b> Sender addresses and sealed on-chain roles do.</p></div>
      </aside>

      <div className="workbench">
        <div className="workbench-head"><div><span className="section-tag">CONTROL WORKBENCH</span><h2>{modeLabel}</h2></div><div className={`status-lamp ${status === "CLEARED" || status === "PERMIT_CONSUMED" ? "green" : ""}`}><i/>{status}</div></div>
        <nav className="modes">{(["create", "technician", "inspector", "assess", "consume"] as const).map(item => <button key={item} className={mode === item ? "selected" : ""} onClick={() => setMode(item)}>{item === "create" ? "01 LOCK" : item === "technician" ? "02 REPAIR" : item === "inspector" ? "03 INSPECT" : item === "assess" ? "04 REVIEW" : "05 RESTART"}</button>)}</nav>

        <div className="form-grid">
          {mode === "create" && <>
            <Field label="CASE ID" value={form.caseId} onChange={v => set("caseId", v)}/><Field label="ASSET ID" value={form.assetId} onChange={v => set("assetId", v)}/>
            <Field label="TECHNICIAN ADDRESS" value={form.technician} onChange={v => set("technician", v)}/><Field label="INSPECTOR ADDRESS" value={form.inspector} onChange={v => set("inspector", v)}/>
            <Field label="OPERATOR ADDRESS" value={form.operator} onChange={v => set("operator", v)}/><Field label="POLICY REPOSITORY" value={form.policyRepository} onChange={v => set("policyRepository", v)}/>
            <Field wide label="COMMIT-PINNED POLICY URL" value={form.policyUrl} onChange={v => set("policyUrl", v)}/><Field label="POLICY SHA-256" value={form.policyHash} onChange={v => set("policyHash", v)}/>
            <Field label="POLICY BYTES" value={form.policyBytes} onChange={v => set("policyBytes", v)}/><Field label="INCIDENT DIGEST" value={form.incidentDigest} onChange={v => set("incidentDigest", v)}/>
            <Field label="RESTART PAYLOAD DIGEST" value={form.restartDigest} onChange={v => set("restartDigest", v)}/><Field label="TECHNICIAN REPOSITORY" value={form.technicianRepository} onChange={v => set("technicianRepository", v)}/>
            <Field label="INSPECTOR REPOSITORY" value={form.inspectorRepository} onChange={v => set("inspectorRepository", v)}/>
          </>}
          {(mode === "technician" || mode === "inspector") && <><div className="evidence-callout"><Link2/><div><b>{mode.toUpperCase()} EVIDENCE</b><p>Must use the repository sealed for this role and a full 40-character commit SHA.</p></div></div><Field wide label="RAW GITHUB MARKDOWN URL" value={form.evidenceUrl} onChange={v => set("evidenceUrl", v)}/><Field label="CONTENT SHA-256" value={form.evidenceHash} onChange={v => set("evidenceHash", v)}/><Field label="EXACT BYTE COUNT" value={form.evidenceBytes} onChange={v => set("evidenceBytes", v)}/></>}
          {mode === "assess" && <div className="decision-panel"><Gauge/><div><b>SEMANTIC SAFETY REVIEW</b><p>Validators fetch three immutable commitments, check identity binding, every mandatory limit and independent corroboration.</p><div className="verdicts"><span>CLEARED</span><span>BLOCKED</span><span>CONFLICTED</span><span>INSUFFICIENT</span></div></div></div>}
          {mode === "consume" && <><Field wide label="SEALED RESTART PAYLOAD DIGEST" value={form.restartDigest} onChange={v => set("restartDigest", v)}/><Field wide label="OPERATION ID" value={form.operationId} onChange={v => set("operationId", v)}/></>}
        </div>
        <div className="action-row"><div><span>CONNECTED ROLE</span><b>{role}</b><small>{actionGate.reason}</small></div><button className="primary" disabled={!actionGate.allowed} title={actionGate.reason} onClick={submit}><Power size={19}/>{modeLabel.toUpperCase()}</button></div>
        {(error || txState !== "IDLE") && <div className={`transaction ${error ? "bad" : ""}`}>{error ? <CircleAlert/> : <Activity/>}<div><b>{error ? "TRANSACTION STOPPED" : txState}</b><p>{error || (txState === "VERIFIED" ? "Finalized and confirmed by an on-chain state read." : "Keep this window open while GenLayer reaches consensus.")}</p></div>{txHash && <a href={explorer(txHash)} target="_blank">EXPLORER <ArrowUpRight size={14}/></a>}</div>}
      </div>
    </section>

    <section className="readback">
      <div className="readback-title"><span className="section-tag">ON-CHAIN READBACK</span><h2>Permit instrument panel</h2></div>
      <Metric icon={<ClipboardCheck/>} label="CASE" value={String(state?.case_id || form.caseId)} note={String(state?.asset_id || form.assetId)}/>
      <Metric icon={<ShieldCheck/>} label="VERDICT" value={String(state?.verdict || "PENDING")} note={String(state?.status || "not synchronized")}/>
      <Metric icon={<Power/>} label="CONSUMED" value={state?.consumed ? "YES" : "NO"} note={state?.receipt ? short(String(state.receipt)) : "no receipt"}/>
      <div className="identity-ledger"><span>TECHNICIAN <b>{short(String(state?.technician || form.technician))}</b></span><span>INSPECTOR <b>{short(String(state?.inspector || form.inspector))}</b></span><span>OPERATOR <b>{short(String(state?.operator || form.operator))}</b></span></div>
      {state && <div className="provenance-ledger"><span>POLICY <b>{short(String(state.policy_sha256 || ""))} · {String(state.policy_bytes || 0)} B</b></span><span>TECH REPORT <b>{short(String(state.technician_sha256 || ""))} · {String(state.technician_bytes || 0)} B</b></span><span>INSPECTION <b>{short(String(state.inspector_sha256 || ""))} · {String(state.inspector_bytes || 0)} B</b></span></div>}
    </section>
    <footer><b>SAFERESTART</b><span>Evidence-bounded · Sender-authorized · One-time restart</span><a href="https://genlayer.com" target="_blank">BUILT ON GENLAYER <ArrowUpRight size={13}/></a></footer>
  </main>;
}

function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label className={wide ? "field wide" : "field"}><span>{label}</span><input value={value} onChange={e => onChange(e.target.value)} placeholder="Required"/></label>;
}
function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className="metric"><div className="metric-icon">{icon}</div><span>{label}</span><b>{value}</b><small>{note}</small></div>;
}
