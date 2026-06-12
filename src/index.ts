import { scanContract } from "./scanner";
import { scanAddress } from "./addressChecker";
import { buildRiskReport } from "./reporter";
import type { SkillInput, SkillOutput } from "./types";

/**
 * ContractRiskScanner — Pharos/Anvita Skill
 *
 * Performs a pre-transaction security check on an EVM contract or wallet address.
 * Powered by GoPlus Security APIs (no API key required for basic checks).
 *
 * Input:
 *   address        - contract or wallet address to check
 *   chainId        - EVM chain ID (1=Ethereum, 56=BSC, 137=Polygon, etc.)
 *   checkType      - "token" | "address" | "both" (default: "both")
 *
 * Output:
 *   riskScore      - 0 (safe) to 100 (critical)
 *   riskLevel      - "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
 *   flags          - array of specific risk flags found
 *   recommendation - "PROCEED" | "CAUTION" | "BLOCK"
 *   details        - full breakdown of checks performed
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

  // Run checks in parallel where applicable
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

  return buildRiskReport(results);
}