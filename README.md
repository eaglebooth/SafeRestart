# SafeRestart

SafeRestart is an AI-governed equipment restart permit on GenLayer. A controller locks an exact equipment case and assigns a technician, independent inspector and restart operator. Commit-pinned Markdown supplies bounded facts; transaction senders supply authority.

## Why GenLayer

The core decision is semantic: whether two independent maintenance records satisfy every requirement of a sealed restart policy for the exact asset and incident. GenLayer validators fetch digest-bound evidence and agree on one closed verdict. Only `CLEARED` enables the one-time operator capability.

## Authority and evidence

- The deployment sender receives no owner or runtime role.
- The case creator becomes controller through `gl.message.sender_address`.
- Technician, inspector and operator are sealed addresses.
- Technician and inspector must differ.
- Policy, technician evidence and inspection evidence use three distinct repositories.
- Every source is raw GitHub Markdown pinned to a 40-character commit, SHA-256 and byte count.
- Text claiming a role has no authority.

## Test-role mapping

- Wallet A (`0xeb57…81f8`): controller and technician.
- Wallet B (`0x2da5…843f`): independent inspector and operator.
- Main wallet: deployment only.

## Local verification

```bash
npm install
npm run lint
npm run build
python -m pytest -q -p no:cacheprovider
```

Copy `.env.example` to `.env.local` after deployment and set `NEXT_PUBLIC_CONTRACT_ADDRESS`.

## Studionet deployment

- Chain ID: `61999`
- Contract: `0x18d02CA86fAFd488A7d1aD978D661B3281BC0afd`
- Explorer: https://explorer-studio.genlayer.com/address/0x18d02CA86fAFd488A7d1aD978D661B3281BC0afd
- The deployer has no implicit role; runtime authority begins only when a test wallet creates a case.

## Lifecycle

`LOCKED → EVIDENCE_OPEN → READY_FOR_REVIEW → CLEARED | BLOCKED | CONFLICTED | INSUFFICIENT_EVIDENCE → PERMIT_CONSUMED`
