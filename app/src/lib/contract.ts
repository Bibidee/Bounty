import type { GenLayerClient } from "genlayer-js/types";
import { TransactionStatus } from "genlayer-js/types";
import { CONTRACT_ADDRESS, chain } from "./config";

export type ReportStatus =
  | "submitted"
  | "disputed"
  | "valid"
  | "invalid"
  | "duplicate"
  | "unresolved"
  | "withdrawn";

export interface Report {
  id: number;
  reporter: string;
  title: string;
  description: string;
  evidence_url: string;
  bond: number;
  status: ReportStatus;
  verdict_reason: string;
  created_at: string;
  resolved_at: string;
}

export interface ProgramInfo {
  maintainer: string;
  repo_issues_url: string;
  scope_description: string;
  min_bond: number;
  pool_balance: number;
  report_count: number;
}

type Client = GenLayerClient<typeof chain>;

export async function readProgramInfo(client: Client): Promise<ProgramInfo> {
  return (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_program_info",
    args: [],
  })) as unknown as ProgramInfo;
}

export async function readReportIds(client: Client): Promise<number[]> {
  return (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "list_report_ids",
    args: [],
  })) as unknown as number[];
}

export async function readReport(client: Client, reportId: number): Promise<Report> {
  return (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_report",
    args: [reportId],
  })) as unknown as Report;
}

export interface WriteOptions {
  onStatus?: (status: TransactionStatus) => void;
}

async function waitWithProgress(
  client: Client,
  hash: string,
  onStatus?: (status: TransactionStatus) => void
) {
  onStatus?.(TransactionStatus.PENDING);
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as Parameters<Client["waitForTransactionReceipt"]>[0]["hash"],
    status: TransactionStatus.ACCEPTED,
    interval: 5000,
    retries: 90,
  });
  onStatus?.(
    (receipt.statusName as TransactionStatus | undefined) ?? TransactionStatus.ACCEPTED
  );
  return receipt;
}

export async function submitReport(
  client: Client,
  args: { title: string; description: string; evidenceUrl: string; bondWei: bigint },
  opts?: WriteOptions
) {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "submit_report",
    args: [args.title, args.description, args.evidenceUrl],
    value: args.bondWei,
  });
  return waitWithProgress(client, hash, opts?.onStatus);
}

export async function withdrawUnresolved(
  client: Client,
  reportId: number,
  opts?: WriteOptions
) {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "withdraw_unresolved",
    args: [reportId],
    value: 0n,
  });
  return waitWithProgress(client, hash, opts?.onStatus);
}

export async function acceptReport(
  client: Client,
  reportId: number,
  bountyAmount: number,
  opts?: WriteOptions
) {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "accept_report",
    args: [reportId, bountyAmount],
    value: 0n,
  });
  return waitWithProgress(client, hash, opts?.onStatus);
}

export async function disputeReport(
  client: Client,
  reportId: number,
  opts?: WriteOptions
) {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "dispute_report",
    args: [reportId],
    value: 0n,
  });
  return waitWithProgress(client, hash, opts?.onStatus);
}

export async function resolveDispute(
  client: Client,
  reportId: number,
  bountyAmount: number,
  opts?: WriteOptions
) {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "resolve_dispute",
    args: [reportId, bountyAmount],
    value: 0n,
  });
  return waitWithProgress(client, hash, opts?.onStatus);
}

export async function fundPool(
  client: Client,
  amountWei: bigint,
  opts?: WriteOptions
) {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "fund_pool",
    args: [],
    value: amountWei,
  });
  return waitWithProgress(client, hash, opts?.onStatus);
}

/** Cross-check every functionName above against the deployed contract's real schema. */
export async function verifyContractSchema(client: Client): Promise<string[]> {
  const schema = await client.getContractSchema(CONTRACT_ADDRESS);
  const expected = [
    "get_program_info",
    "list_report_ids",
    "get_report",
    "submit_report",
    "withdraw_unresolved",
    "accept_report",
    "dispute_report",
    "resolve_dispute",
    "fund_pool",
  ];
  const known = new Set(Object.keys(schema.methods));
  return expected.filter((name) => !known.has(name));
}
