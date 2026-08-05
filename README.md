# Bounty Verdict

**Live:** https://bounty-alpha.vercel.app

A trustless escrow for security bug bounties, built on GenLayer.

A researcher stakes a GEN bond alongside a vulnerability report. The
maintainer can accept it outright, or dispute it. A disputed report is
resolved by the contract itself — not by the maintainer — through a GenLayer
consensus round that fetches the target repository's real issue history and
judges whether the report is a genuine, novel, in-scope vulnerability, a
duplicate of something already known, or invalid.

## Who it's for

Any open-source maintainer running an informal bounty program, and any
researcher tired of reports being ignored or lowballed by the one party who
has every incentive to say no.

## The problem

Most ad-hoc bounty programs (a line in a README, a Discord channel, an email
address) put the maintainer in sole control of "is this valid." That is a
conflict of interest by construction: the maintainer pays out of pocket and
decides whether they owe anything. Reports get stalled, silently rejected, or
paid inconsistently, and there is no record a researcher can point to.

## Why this needs GenLayer

**The counterfactual:** delete GenLayer from this design and one party — the
maintainer — decides validity alone, with a financial incentive to say no.
Every counterparty (the researcher) has to trust them.

**Two distrusting parties:** the researcher wants to be paid for genuine,
novel findings; the maintainer wants to pay only for genuine, in-scope,
non-duplicate findings and has every reason to stall or reject anything that
costs money. Their interests are directly opposed.

**Irreducibly semantic:** "does this report describe a real, novel, in-scope
vulnerability" is a judgment call over prose evidence, not a value a regex or
price feed can answer.

**Evidence the contract fetches itself:** on dispute, the contract fetches
the repository's own issue-tracker URL and, if supplied, the reporter's
evidence page — live, at resolution time — rather than trusting a list either
party hands it.

See [docs/decision-record.md](docs/decision-record.md) for the full set of 8
candidates considered and how this one was chosen against every gate.

## How consensus is used

Only one thing goes to the model: whether a disputed report is
`valid` / `duplicate` / `invalid` / `unresolved` (abstention). Everything
else — bond accounting, escrow balances, access control, state transitions,
payout arithmetic — is plain deterministic Python.

The judgment call is wrapped in `gl.eq_principle.prompt_comparative` with this
principle, quoted verbatim from the contract:

> Both outputs must agree on the same 'outcome' category (valid, duplicate,
> invalid, or unresolved). The 'reason' text may differ in wording as long as
> it supports the same outcome. Disagreement on outcome category means the
> outputs are not equivalent.

The principle compares *decisions*, not phrasing or format — validators are
free to write different reasoning as long as they land on the same category.
The output is deliberately banded into four fixed categories rather than a
free-form score, so validators can agree on a bucket instead of a float.

**Why deterministic-everywhere-else strengthens the case for consensus, not
weakens it:** if the contract let a model decide access control or payout
math, a single hallucination could move funds arbitrarily. By confining the
model to exactly the one question that is genuinely subjective — and pinning
every dollar-moving branch to a fixed, auditable Python `if/elif` — the
non-determinism budget stays small (one nondet round, two fetches at most)
while the part that actually needs judgment gets it.

**Abstention is mandatory.** A fetch failure, an unparseable model reply, or
an out-of-range outcome value all map to `unresolved`, not to a guess. An
`unresolved` report refunds the bond in full — nothing is lost to a coin
flip, and the report can be redisputed.

## Architecture

```
contracts/bounty_verdict.py   Intelligent Contract (source of truth)
tests/direct/                 33 direct-mode tests (mocked web/LLM, no network)
tests/integration/            gltest suite against real StudioNet consensus
app/                          Next.js App Router frontend (TypeScript, Tailwind)
  src/lib/config.ts           chain + contract address, one source of truth
  src/lib/wallet.tsx          injected + generated wallet, one identity for reads/writes
  src/lib/contract.ts         typed call sites, cross-checked against getContractSchema
  src/lib/useTransaction.ts   surfaces the real consensus lifecycle in the UI
  scripts/verify-schema.mjs   fails CI if a frontend call site drifts from the deployed contract
```

There is no backend service and no database. The Next.js app reads and writes
the contract directly through `genlayer-js`; the contract is the only source
of truth.

## The two-wallet model

- An injected wallet (MetaMask, etc.) is detected automatically and used if
  present.
- With no injected wallet, the app generates a private key in the browser,
  persists it in `localStorage`, and lets the user submit reports
  immediately — after acknowledging an explicit warning that the key is not
  custody-grade and lives only in that browser.
- Export/import are both available so a generated identity isn't trapped in
  one browser.
- **Reads and writes always share the same identity** — the address shown in
  the wallet badge is the exact account every write is signed from
  (`src/lib/wallet.tsx`).

## Deployed contract

- **Network:** StudioNet
- **Address:** `0xe0300064F9AD45145af03A8256df76C2688eC6b1`
- **Deployment transaction:** `0x7c40659114313216570708d47f6f75099746bc89a7a43a1af4e5ac73b293c91b`
- **Explorer:** https://explorer-studio.genlayer.com/tx/0x7c40659114313216570708d47f6f75099746bc89a7a43a1af4e5ac73b293c91b
- **Result:** `Execution Result: SUCCESS`, `Result Code: Return`. Every read
  and write below was exercised directly against this address on real
  StudioNet, not simulated.
- **Live frontend:** https://bounty-alpha.vercel.app — confirmed reading
  live reports from this contract, including deep links loading standalone
  with real consensus verdict reasoning.

This is a redeploy. An earlier deployed address
(`0x507D22C70976d5000Ef4c703D391Ed6F2F2134FA`) is retired — see *Real bugs
found and fixed* below for why.

## Setup

```bash
# Contract tooling
npm install -g genlayer
pip install genvm-linter genlayer-test

# Contract
PYTHONIOENCODING=utf-8 GENVM_VERSION=v0.2.16 genvm-lint check contracts/bounty_verdict.py --json
python -m pytest tests/direct -v
gltest tests/integration -v -s --network studionet

# Frontend
cd app
npm install
npm run dev            # requires app/.env.local, see below
npm run verify-schema  # cross-checks every call site against the deployed contract
```

`app/.env.local`:

```
NEXT_PUBLIC_GENLAYER_CHAIN=studionet
NEXT_PUBLIC_CONTRACT_ADDRESS=0xe0300064F9AD45145af03A8256df76C2688eC6b1
```

## Tests and results

- **Direct-mode (`tests/direct/test_bounty_verdict.py`): 33/33 passing.**
  Covers every write method, every value-moving branch (accept/dispute/
  resolve × valid/duplicate/invalid/unresolved), permissionless resolution,
  malformed/fenced/already-decoded-dict LLM output, a failed web fetch that
  must not crash the contract, boundary bond amounts, and access control on
  every privileged method.
- **`genvm-lint check`**: AST safety checks and SDK-based semantic validation
  both pass (`lint.ok: true, validate.ok: true`, 12 methods, 6 view / 6
  write, 4 constructor params).
- **Every write method exercised directly on live StudioNet consensus**,
  outside the test suite, against the currently deployed address, **with
  payouts confirmed by reading the recipient's actual native balance
  (`eth_getBalance`), not just the contract's internal bookkeeping**:

  | Call | Result |
  |---|---|
  | `submit_report(...)` + `withdraw_unresolved(...)`, reporter bonded 25 wei | status `submitted → withdrawn`; reporter's real on-chain balance confirmed `0 → 25` wei |
  | `submit_report(...)` + `dispute_report(...)` + `resolve_dispute(..., 0)` — an in-scope but unsubstantiated auth-bypass report, **real consensus round**, live web fetch + LLM judgment | verdict: `unresolved` (abstention) — *"The reported auth bypass is in scope, but no fetched evidence substantiates that /admin/users lacks an admin-role check, and the existing issue history shown does not indicate a matching prior report."* Bond refunded; reporter's real balance confirmed `0 → 25` wei |

  Earlier verification rounds (documented below under *bugs found and
  fixed*) ran against a since-retired address and included an `invalid`
  verdict on an out-of-scope CSRF report and a `valid` verdict paid via
  direct maintainer acceptance — both genuine, unscripted consensus
  results, but from before the payout bug was found, so their *fund
  movement* claims were wrong even though their *verdict* content was
  real. The two rounds above are the ones actually proven to move real
  GEN.
- **`npm run verify-schema`** (`app/scripts/verify-schema.mjs`) passes against
  this deployment: all 9 frontend call sites match the real contract schema
  by name and arity.
- **`gltest tests/integration -v -s --network studionet`: 4/4 passing**
  against a freshly-deployed instance each run (deploy, fund, submit, accept,
  withdraw, and a full dispute → resolve round). The consensus round
  produced a real, unscripted verdict:

  ```
  StudioNet verdict for out-of-scope report: 'invalid'
  Reason: 'The report describes a documentation change request rather than
  a Remote Code Execution or Authentication Bypass vulnerability as
  required by the program scope.'
  ```

## Real bugs found and fixed along the way

**The escrow's payout mechanism silently failed to deliver funds — the
most serious bug in this project, and the one I'm least proud of missing
initially.** `_pay()` used `gl.get_contract_at(to).emit_transfer(...)` to
send GEN to reporters. That method sends a `PostMessage`, which GenVM tries
to execute as a contract invocation; against a plain wallet address with no
deployed contract code, it fails with a generic GenVM `ERROR` on a separate
internal transaction, labeled `(constructor)` in the explorer. Critically,
`_pay()`'s Python-level bookkeeping (`report.bond = u256(0)`,
`self.pool_balance -= ...`) runs unconditionally in the same method and has
no way to know the transfer underneath it failed — so every report I'd
marked `valid`, `duplicate`, `unresolved`, or `withdrawn` in earlier testing
looked correctly settled from the contract's own state, while the GEN never
actually left the contract. I caught this by checking a recipient's real
balance directly (`eth_getBalance`) instead of only trusting the contract's
internal counters — it read exactly `0`, while the contract itself still
held the unspent balance. The fix uses `gl.evm.contract_interface` (an empty
`View`/`Write` interface, `ExternalWallet` in the contract) instead, which
sends via the lower-level `EthSend` primitive rather than trying to invoke a
contract that isn't there. Verified after the fix: a recipient's on-chain
balance moved from `0` to exactly the bond amount, wei-for-wei, confirmed
both immediately after a direct withdrawal and after a real consensus
abstention refund. **This required redeploying the contract** — the address
above is that redeploy; an earlier address whose payouts never actually
landed is retired.

**`gltest`'s `Contract` methods return a `ContractFunction` wrapper, not the
result** — a read needs `.call()`, a write needs `.transact(...)`, and
calling as a different signer needs `contract.connect(other_account)` rather
than an `account=` kwarg on the call itself. The first integration test
draft, copied from an older cached example's calling convention, failed with
`TypeError: 'ContractFunction' object is not subscriptable` and later
`TypeError: transact() got an unexpected keyword argument 'account'` —
fixed by reading `gltest`'s actual installed source rather than guessing
from a stale pattern.

**`genvm-lint`'s `validate` step can't load the v0.3.0 SDK line on this
machine** (`No module named 'genlayer.py'`) — a packaging bug in
`genvm-lint 0.11.0`, not this contract. Found by extracting and reading the
actual SDK source for multiple versions rather than trusting the docs or a
stale scaffolded example; `v0.2.16` loads and validates correctly, so the
contract is written and verified against that version's real API
(`gl.Contract`, `allow_storage`, `gl.evm.contract_interface` for paying a
wallet address rather than a nonexistent `gl.chain.Account`, `Response.body`
as `bytes` not `str`).

**The `Depends` header must name an explicit runner hash, not a symbolic
tag — this was the actual deploy blocker, and it cost several failed
attempts to diagnose correctly.** Early deploys used `py-genlayer:latest`
and `py-genlayer:test`; both reached `FINALIZED` consensus but on a GenVM
`Execution Result: ERROR` / `invalid_contract`, with empty stdout/stderr —
looking exactly like a platform outage, and I initially (wrongly) reported
it as one. The real signal was in the explorer's GenVM Execution panel
(`explorer-studio.genlayer.com`, not `genlayer-explorer.vercel.app`, which
is an unrelated, separately-paused deployment I mistook for the real one).
Pinning the exact runner content hash for `v0.2.16`
(`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`, read
directly out of the SDK's own `runner.json`) changed the failure from a
generic `invalid_contract` to a real Python traceback — proof the runner
was now resolving and actually executing the contract.

**The `genlayer` CLI's `deploy --args` takes space-separated positional
values, not one JSON array** — passing `["a","b","c",10]` as a single
`--args` string silently bound the whole array to the first constructor
parameter, producing `TypeError: __init__() missing 3 required positional
arguments`, visible only in the explorer's stderr, not in the CLI's own
"success" output.

**Addresses need the explicit `addr#` prefix or a well-formed `0x` + 40 hex
string** — an ambiguous placeholder address was parsed as raw bytes instead
of an `Address`, producing `Exception: invalid address b'\x00\x00...'` on
the real network.

**The `genlayer write` CLI command hardcodes `value: 0n`** — confirmed by
reading its source directly (`WriteAction.write` in the installed package) —
so it cannot call `@gl.public.write.payable` methods at all. Payable calls
(`submit_report`, `fund_pool`) in the verification below were made with
`genlayer-js` directly, signed by a freshly generated throwaway test
account (the same `generatePrivateKey()`/`createAccount()` pattern the
frontend's own generated-wallet path uses) — never the deployer's key.

## Honest limits

- **`UNDETERMINED` and validator timeouts** (consensus itself failing to
  agree) are handled in the UI as retryable, non-error states
  (`src/components/TxProgress.tsx`), but I have not personally observed
  that specific outcome on-chain — every live write in this session reached
  `ACCEPTED`/`FINALIZED`. The contract's own `unresolved` abstention state
  (consensus agreeing the evidence doesn't substantiate a verdict) is a
  different thing and *was* observed live multiple times, including after
  the payout fix, with the refund confirmed via the recipient's real
  on-chain balance — see *Tests and results* above.
- **StudioNet GEN is test currency, not real money** — but after the payout
  fix, fund movement is proven at the same layer a real chain would use:
  I read a recipient's actual native balance via `eth_getBalance` before and
  after a payout and watched it move by the exact bond amount, not just the
  contract's internal `pool_balance`/`bond` counters. What StudioNet doesn't
  give is real-world monetary stakes behind that balance.
- **The injected-wallet path is implemented and code-reviewed** against the
  same identity-sharing code the generated-wallet path uses (verified live:
  wallet generation, persistence across reload, and reads all confirmed in
  browser), but wasn't click-tested against a real browser extension in
  this environment.
- **The `genlayer write` CLI's Windows build occasionally throws a spurious
  `lstat ...ethers/lib.esm/address/checks.js` error on an otherwise-valid
  call** (seen once on `accept_report`); a bare retry with identical
  arguments succeeded. Not something a contract change affects.

## What I'd do next

Complete a first-time-user walk on the live URL with a real injected wallet
extension (MetaMask or similar) in a normal desktop browser — the
generated-wallet path is already confirmed working live, in-browser,
including persistence across reload, but a real extension wasn't available
to click-test in this environment.
