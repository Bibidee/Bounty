# Decision Record — Bounty Verdict

## Candidates generated (8, spanning ≥3 capabilities, ≥2 involving native value)

1. **Escrowed Freelance Milestone Arbiter** — client deposits GEN, contract fetches the freelancer's deliverable URL and judges spec compliance to release/refund. *(value, web)*
2. **Receipt-Verified Expense Split** — group photographs a shared receipt; contract reads the image to reconcile and split a pooled GEN deposit. *(value, images)*
3. **Semantic Bug Bounty Escrow** — reporter stakes GEN against a vulnerability report; on maintainer dispute, contract fetches the repo's existing issues, uses embeddings to check novelty, and judges validity to release or slash the bond. *(value, web, embeddings)*
4. **Screenshot-Settled Prediction Market** — users bond GEN on claims about a live web page; contract renders a screenshot at resolution time to settle. *(value, images, web)*
5. **Trustless Marketplace Escrow for Physical Goods** — buyer deposits GEN; a shipment-tracking page is fetched to settle release to the seller. *(value, web)*
6. **Duplicate Grant Application Detector** — grant pool funded in GEN; embeddings flag near-duplicate submissions across applicants before payout. *(value, embeddings)*
7. **Content Moderation Appeal Court** — poster stakes GEN to appeal a takedown; contract fetches the actual flagged content and judges it against a stated policy. *(value, web)*
8. **Semantic Trademark/Domain Dispute Resolver** — two parties bond GEN; contract fetches both live sites and judges likelihood of confusion via embeddings + prompt_comparative. *(value, web, embeddings)*

Capability spread across the 8: web fetch (1,3,4,5,7,8), native GEN value (all 8), images/screenshots (2,4), embeddings/semantic search (3,6,8). At least two candidates (3, 6, 8) combine value **and** embeddings, and value-only-plus-web ideas (1,5,7) are deliberately kept distinct in domain rather than reskins of each other.

## Chosen: Semantic Bug Bounty Escrow ("Bounty Verdict")

A security researcher finds a vulnerability in a public repo and stakes a small GEN bond alongside a written report and evidence (issue text, PoC description, affected file/line). The maintainer can accept it outright (bond returned, bounty paid from an escrowed pool) or dispute it. On dispute, the contract:

1. Fetches the target repository's existing open/closed issues itself (deterministic-triggered web fetch inside the nondet round).
2. Uses embeddings to check whether the report is a near-duplicate of a prior disclosure already on record.
3. If not a duplicate, asks the model to judge validity/novelty against the maintainer's stated scope and the fetched issue history — banded output (`valid` / `invalid` / `duplicate` / `insufficient_evidence`), never a raw float.
4. Releases the bounty and returns the bond to the reporter on `valid`; slashes the bond to the maintainer's pool on `invalid`; returns the bond with no bounty on `duplicate`; and abstains (`insufficient_evidence`, fully refundable, re-submittable) when the fetch fails or evidence doesn't resolve.

## Gate check

- **A — counterfactual:** Delete GenLayer and a single party (the maintainer, who is financially motivated to reject reports) decides validity alone — a well-known real-world failure mode (bounty programs "going dark" or lowballing/rejecting valid reports). Consensus removes that unilateral control.
- **B — two distrusting parties:** Reporter (wants payment, has an incentive to inflate/duplicate) vs. maintainer (wants to pay only for genuine, novel, in-scope findings, has an incentive to stall or reject). Interests are opposed.
- **C — irreducibly semantic:** "Is this report novel and does it demonstrate a real, in-scope vulnerability" is a judgment call over prose, not a value a regex or price feed can answer.
- **D — evidence fetched by the contract:** The contract fetches the repo's issue history itself at resolution time rather than trusting whatever list the reporter or maintainer submits.
- **E — return usage:** A maintainer running an ongoing bounty program, or a reporter active across multiple programs, has reason to come back repeatedly — this is a recurring workflow, not a one-off.
- **F — path beyond submission:** Real open-source projects and independent security researchers already run ad-hoc bounty programs over Discord/email with exactly this trust problem; a working escrow removes the "trust the maintainer" step without requiring a platform intermediary.
- **G — latency budget:** The core disputed-report resolution is a single nondet round with two fetches (issue list + optional PoC evidence page) — within the 2–4 minute budget. Straightforward submission and acceptance (no dispute) are fully deterministic and settle in seconds; only a dispute triggers the consensus round, and it's a separate, permissionless-to-trigger transaction so neither party is blocked waiting on the other.

## Self-audit

- **Distinct capabilities actually represented:** native GEN value (escrow + slashing + bounty payout), live web fetch (issue history), on-chain embeddings/semantic search (duplicate detection). Three capabilities, not one dressed up three ways.
- **Candidates that were really the same idea twice:** 1, 5, and 7 are structurally similar (single value-holder, single web-fetch judgment call) — kept only one nearby archetype (bug bounty) and treated it as one bucket, not three separate submissions of the same shape.
- **What I'd have picked without web access:** Duplicate Grant Application Detector (#6) — it only needs embeddings and value, no fetch, and still passes every gate.

## What is deliberately deterministic

Bond accounting, escrow balances, duplicate-check threshold enforcement, state transitions (submitted → accepted/disputed → resolved), access control (only the maintainer can dispute; only the reporter can submit), and payout arithmetic are all plain Python with no model involved. Only "is this report novel/valid/in-scope" goes to the model, banded into four states, validated by `prompt_comparative` (validators re-run the same judgment and must agree in substance, not phrasing).
