import { scanContract } from "./scanner";
import { scanAddress } from "./addressChecker";
import { buildRiskReport } from "./reporter";
import { checkApprovals } from "./approvalChecker";
import { logResultOnChain, getLastOnChainScan, getTotalScans } from "./onchainlogger";
import type { SkillInput, SkillOutput, BatchInput, BatchOutput } from "./types";

export { getLastOnChainScan, getTotalScans };

/**
 * ContractRiskScanner — Pharos/Anvita Skill
 *
 * Single scan:    run(input)
 * Batch scan:     runBatch(input)
 * Approval check: runApprovalCheck(address, chainId)
 * On-chain history: getLastOnChainScan(address)
 * Total scans logged: getTotalScans()
 */
export async function run(input: SkillInput): Promise<SkillOutput> {
  const { address, chainId, checkType = "both" } = input;

  if (!address || !chainId) {
    return {
      riskScore: -1,
      riskLevel: "UNKNOWN",
      flags: [],
      recommendation: "BLOCK",
      details: { error: "Missing required fields: address and chainId" },
    };
  }

  const normalizedAddress = address.toLowerCase().trim();
  const results: Record<string, unknown> = {};

  const [tokenResult, addressResult] = await Promise.allSettled([
    checkType !== "address"
      ? scanContract(normalizedAddress, chainId)
      : Promise.resolve(null),
    checkType !== "token"
      ? scanAddress(normalizedAddress, chainId)
      : Promise.resolve(null),
  ]);

  if (tokenResult.status === "fulfilled") results.token = tokenResult.value;
  if (addressResult.status === "fulfilled") results.address = addressResult.value;

  const report = buildRiskReport(results);

  // Auto-log to Pharos ScanRegistry if PHAROS_PRIVATE_KEY is set
  const txHash = await logResultOnChain(normalizedAddress, chainId, report);
  if (txHash) {
    report.details.onChainLog = { contract: "0xa921bFDb1F5e61d78aC3aE9833AD9fFdbe3e2e09", network: "Pharos Atlantic Testnet" };
  }

  return report;
}

/**
 * Feature #2 — Approval Risk Check
 * Checks if a wallet has dangerous token approvals outstanding.
 */
export async function runApprovalCheck(address: string, chainId: string | number) {
  return checkApprovals(address, chainId);
}

/**
 * Batch scan multiple addresses with concurrency control.
 */
export async function runBatch(input: BatchInput): Promise<BatchOutput> {
  const { addresses, concurrency = 3 } = input;
  const startTime = Date.now();

  if (!addresses || addresses.length === 0) {
    return {
      results: [],
      summary: { total: 0, safe: 0, caution: 0, blocked: 0, highestRisk: "UNKNOWN", scanDurationMs: 0 },
    };
  }

  const results: Array<SkillOutput & { address: string; chainId: string | number }> = [];

  for (let i = 0; i < addresses.length; i += concurrency) {
    const chunk = addresses.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        const result = await run(item);
        return { ...result, address: item.address, chainId: item.chainId };
      })
    );
    results.push(...chunkResults);
    if (i + concurrency < addresses.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const riskOrder = ["SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"];
  let highestRiskIndex = 0;
  let safe = 0, caution = 0, blocked = 0;

  for (const r of results) {
    if (r.recommendation === "PROCEED") safe++;
    else if (r.recommendation === "CAUTION") caution++;
    else blocked++;
    const idx = riskOrder.indexOf(r.riskLevel);
    if (idx > highestRiskIndex) highestRiskIndex = idx;
  }

  return {
    results,
    summary: {
      total: results.length,
      safe,
      caution,
      blocked,
      highestRisk: riskOrder[highestRiskIndex],
      scanDurationMs: Date.now() - startTime,
    },
  };
}