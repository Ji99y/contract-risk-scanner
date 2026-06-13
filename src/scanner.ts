import type { GoPlusTokenData, GoPlusTokenResponse } from "./types";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
// Pharos chains — GoPlus indexing coming soon
const PHAROS_CHAIN_IDS = new Set(["1672", "688688"]);
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Fetches token security data from GoPlus Token Security API.
 * No API key required for standard usage (rate-limited).
 */
export async function scanContract(
  address: string,
  chainId: string | number
): Promise<GoPlusTokenData | null> {
  const url = `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${address}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    if (PHAROS_CHAIN_IDS.has(String(chainId))) {
  return null; // GoPlus does not yet index Pharos — address check still runs
}
const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[ContractRiskScanner] Token API error: ${res.status}`);
      return null;
    }

    const json = await res.json() as GoPlusTokenResponse;

    if (json.code !== 1) {
      console.error(`[ContractRiskScanner] Token API returned code ${json.code}: ${json.message}`);
      return null;
    }

    // GoPlus returns results keyed by lowercase address
    const resultKey = Object.keys(json.result ?? {})[0];
    return resultKey ? json.result[resultKey] : null;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[ContractRiskScanner] Token API request timed out");
    } else {
      console.error("[ContractRiskScanner] Token API fetch failed:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}