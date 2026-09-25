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

Pending publication of three commit-pinned source documents in three distinct repositories. Live transaction hashes will be recorded only after the exact Git commit, SHA-256 and byte count are fixed.

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

