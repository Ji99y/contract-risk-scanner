import type { GoPlusAddressResponse } from "./types";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Fetches malicious address data from GoPlus Address Security API.
 * Checks if an address is flagged for phishing, blacklisting, cybercrime, etc.
 */
export async function scanAddress(
  address: string,
  chainId: string | number,
): Promise<GoPlusAddressResponse["result"] | null> {
  const url = `${GOPLUS_BASE}/address_security/${address}?chain_id=${chainId}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[ContractRiskScanner] Address API error: ${res.status}`);
      return null;
    }

    const json = (await res.json()) as GoPlusAddressResponse;

    if (json.code !== 1) {
      console.error(
        `[ContractRiskScanner] Address API returned code ${json.code}: ${json.message}`,
      );
      return null;
    }

    return json.result ?? null;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[ContractRiskScanner] Address API request timed out");
    } else {
      console.error("[ContractRiskScanner] Address API fetch failed:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
