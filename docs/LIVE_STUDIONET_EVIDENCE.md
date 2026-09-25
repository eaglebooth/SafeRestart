# SafeRestart live Studionet evidence

## Deployment

- Network: Studionet, chain `61999`
- Contract: `0x18d02CA86fAFd488A7d1aD978D661B3281BC0afd`
- Explorer: https://explorer-studio.genlayer.com/address/0x18d02CA86fAFd488A7d1aD978D661B3281BC0afd
- Schema verification: passed on 2026-09-25
- Initial state: `{"case_count":0,"execution_count":0}`

The deployment wallet has no stored owner or operational authority. Runtime roles are created only by `create_case`, whose controller is the transaction sender.

## Planned role separation

- Test wallet A: controller and technician
- Test wallet B: independent inspector and restart operator
- Deployment wallet: no lifecycle transaction

## Source commitments

| Role | Commit-pinned source | SHA-256 | Bytes |
|---|---|---|---:|
| Policy | https://github.com/eaglebooth/SafeRestart/blob/c90e2ff9332dc6a2166e063b27778727bb1ac446/fixtures/RESTART_POLICY.md | `d57377edb611939e9186c22dfdcc77902586099fa14407391ef12256e2b7b77d` | 450 |
| Technician | https://github.com/eaglebooth/PatchProof/blob/c2b34f0fc7e0768ce325f0c843363baadfb185ac/SAFERESTART_TECHNICIAN_REPORT.md | `22d15eefcdb662ef351158590fa6aa351c39728259bba41d719c5569f27cca41` | 950 |
| Inspector | https://github.com/eaglebooth/ClaimAnchor/blob/c49e4c3d83034619b985a4da0fe05d12d09b3164/SAFERESTART_INSPECTION_REPORT.md | `22bfa52dae0b2d70d241ad24839889ddc7526bcaf8292c04279466f7bb410f68` | 1015 |

## Required live paths

1. Create case by wallet A.
2. Reject technician submission by wallet B.
3. Accept technician evidence by wallet A.
4. Reject restart before assessment.
5. Accept independent inspection by wallet B.
6. Assess to `CLEARED` through validator consensus.
7. Reject restart by wallet A because only wallet B is operator.
8. Consume the exact restart payload once by wallet B.
9. Reject replay by wallet B.
10. Re-read final case and receipt from chain.

## Live transaction ledger

| Path | Expected | Observed | Explorer |
|---|---|---|---|
| Create case by wallet A | Success | `SUCCESS` | https://explorer-studio.genlayer.com/tx/0x08e77cfa15425454f05513ca5281071d1ca18b12179112a74deabae95b793edc |
| Wallet B impersonates technician | Revert | `ERROR` | https://explorer-studio.genlayer.com/tx/0xd86fe91e53cf43dc9406dbd0e31af212904aff23976031023582298d335c6320 |
| Technician evidence by wallet A | Success | `SUCCESS` | https://explorer-studio.genlayer.com/tx/0xb959e63ad29cee096a7eb09a1a731f3ce7e62af6eef83d7f329cd419050fe076 |
| Restart before review | Revert | `ERROR` | https://explorer-studio.genlayer.com/tx/0xc84301b6afbc2ccf007b5d02095faff897071393c11c111032fcde5a336fc2b7 |
| Independent inspection by wallet B | Success | `SUCCESS` | https://explorer-studio.genlayer.com/tx/0x50c0f60f0d03f8b7280c4ff14a77dc81ce2724440e4b1b483c00e67cab1c515f |
| Semantic assessment | Success | `CLEARED` | https://explorer-studio.genlayer.com/tx/0x15e73e90c154ae91182e2f8e796c3c166b921fb15ac3a3ad0e73309d091c62ab |
| Wallet A impersonates operator | Revert | `ERROR` | https://explorer-studio.genlayer.com/tx/0x78f16f97b4860f48d495c0840a7264c4d4302f61e3ae72e2d17571e2a4584473 |
| Restart consumed by wallet B | Success | `SUCCESS` | https://explorer-studio.genlayer.com/tx/0x6b6e186b2f8b82d83bb73f9841e6fbca07dd7899b87880480249f62f021187d4 |
| Replay consumed permit | Revert | `ERROR` | https://explorer-studio.genlayer.com/tx/0xa57ad93531c13dc8e1021e239c5a3a1aa6f38176a21f8a6d39bcfd462430a72a |

## Final canonical state

- `status`: `PERMIT_CONSUMED`
- `verdict`: `CLEARED`
- `consumed`: `true`
- `assessment_digest`: `ca7d44ec5aa3602fcf9433d39dcf330786f6295ef2e4a59e811e59b000745823`
- `receipt`: `22e675224b5873f3e1c3f2910333bb94d1b0b9b8fb4cec649b261770041525a1`
- `case_count`: `1`
- `execution_count`: `1`

The final state was re-read after the transient RPC response that occurred while inspecting the replay transaction. The existing replay hash was not resubmitted; it finalized with `MAJORITY_AGREE / ERROR`.
