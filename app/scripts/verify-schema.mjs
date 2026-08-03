// Verifies every functionName used in src/lib/contract.ts actually exists on
// the deployed contract, with matching arity, by fetching the real schema.
// Run: node scripts/verify-schema.mjs
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x507D22C70976d5000Ef4c703D391Ed6F2F2134FA";

const EXPECTED = {
  get_program_info: 0,
  list_report_ids: 0,
  get_report: 1,
  submit_report: 3,
  withdraw_unresolved: 1,
  accept_report: 2,
  dispute_report: 1,
  resolve_dispute: 2,
  fund_pool: 0,
};

async function main() {
  const client = createClient({ chain: studionet, account: createAccount() });
  console.log(`Fetching schema for ${CONTRACT_ADDRESS} on studionet...`);
  const schema = await client.getContractSchema(CONTRACT_ADDRESS);

  let failed = false;
  for (const [name, arity] of Object.entries(EXPECTED)) {
    const method = schema.methods[name];
    if (!method) {
      console.error(`✗ ${name} is not present on the deployed contract`);
      failed = true;
      continue;
    }
    if (method.params.length !== arity) {
      console.error(
        `✗ ${name} expects ${method.params.length} positional args, frontend calls with ${arity}`
      );
      failed = true;
      continue;
    }
    console.log(`✓ ${name} (${method.params.length} args, readonly=${method.readonly})`);
  }

  if (failed) {
    console.error("\nSchema verification FAILED.");
    process.exit(1);
  }
  console.log("\nSchema verification passed — every frontend call site matches the deployed contract.");
}

main().catch((err) => {
  console.error("Schema verification errored:", err.message ?? err);
  process.exit(1);
});
