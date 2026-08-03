import { studionet, localnet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";

const CHAINS = {
  studionet,
  localnet,
  testnetAsimov,
  testnetBradbury,
} as const;

type ChainName = keyof typeof CHAINS;

function resolveChainName(): ChainName {
  const raw = process.env.NEXT_PUBLIC_GENLAYER_CHAIN ?? "studionet";
  if (raw in CHAINS) return raw as ChainName;
  return "studionet";
}

export const chainName = resolveChainName();
export const chain = CHAINS[chainName];

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "") as `0x${string}`;

export const EXPLORER_TX_URL = (hash: string) =>
  `https://genlayer-explorer.vercel.app/tx/${hash}`;

export const EXPLORER_ADDRESS_URL = (address: string) =>
  `https://genlayer-explorer.vercel.app/address/${address}`;

export const WALLET_STORAGE_KEY = "bounty-verdict.generated-wallet.v1";
export const WALLET_ACK_STORAGE_KEY = "bounty-verdict.generated-wallet.ack.v1";

if (!CONTRACT_ADDRESS) {
  // Loud in dev; every page that reads this should handle the empty case too.
  // eslint-disable-next-line no-console
  console.warn(
    "NEXT_PUBLIC_CONTRACT_ADDRESS is not set. Configure it in .env.local."
  );
}
