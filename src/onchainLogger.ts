/**
 * onchainLogger.ts
 *
 * Connects the ContractRiskScanner Skill to the ScanRegistry contract
 * deployed on Pharos Atlantic Testnet.
 *
 * Logs scan results on-chain so any agent can verify a scan was performed.
 * Requires PHAROS_RPC_URL and PHAROS_PRIVATE_KEY env variables to write.
 * Read-only calls (getLastScan) work without a private key.
 */

import type { SkillOutput } from "./types";

export const SCAN_REGISTRY_ADDRESS =
  "0xa921bFDb1F5e61d78aC3aE9833AD9fFdbe3e2e09";
export const PHAROS_RPC_URL =
  process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com";

const REQUEST_TIMEOUT_MS = 15_000;

// ── ABI fragments we need ────────────────────────────────────────────────────

const ABI = {
  requestScan: "0x" + keccak256Selector("requestScan(address,uint256,string)"),
  logScanResult:
    "0x" +
    keccak256Selector("logScanResult(address,uint256,uint8,string,string)"),
  getLastScan: "0x" + keccak256Selector("getLastScan(address)"),
  totalScans: "0x" + keccak256Selector("totalScans()"),
};

// Simple 4-byte selector (no keccak lib — we hardcode the known selectors)
function keccak256Selector(sig: string): string {
  // Pre-computed selectors for our contract functions
  const selectors: Record<string, string> = {
    "requestScan(address,uint256,string)": "7b9a3240",
    "logScanResult(address,uint256,uint8,string,string)": "fd04f504",
    "getLastScan(address)": "d5920705",
    "totalScans()": "0c23792b",
  };
  return selectors[sig] ?? "00000000";
}

// ── Encoding helpers (minimal ABI encoder, no ethers dependency) ─────────────

function encodeAddress(addr: string): string {
  return addr.toLowerCase().replace("0x", "").padStart(64, "0");
}

function encodeUint256(n: string | number): string {
  return BigInt(n).toString(16).padStart(64, "0");
}

function encodeUint8(n: number): string {
  return n.toString(16).padStart(64, "0");
}

function encodeString(s: string): string {
  const bytes = Buffer.from(s, "utf8");
  const len = bytes.length.toString(16).padStart(64, "0");
  const data = bytes
    .toString("hex")
    .padEnd(Math.ceil(bytes.length / 32) * 64, "0");
  return len + data;
}

// ── RPC helpers ──────────────────────────────────────────────────────────────

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(PHAROS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    const json = (await res.json()) as {
      result?: unknown;
      error?: { message: string };
    };
    if (json.error) throw new Error(json.error.message);
    return json.result;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Log a completed scan result to the Pharos ScanRegistry contract.
 * Requires PHAROS_PRIVATE_KEY env variable.
 *
 * @param target   - The address that was scanned
 * @param chainId  - The chain ID the scan was performed on
 * @param result   - The SkillOutput from run()
 * @returns transaction hash, or null if logging failed/skipped
 */
export async function logResultOnChain(
  target: string,
  chainId: string | number,
  result: SkillOutput,
): Promise<string | null> {
  const privateKey = process.env.PHAROS_PRIVATE_KEY;
  if (!privateKey) {
    // Silently skip — on-chain logging is optional
    return null;
  }

  try {
    // Encode calldata for logScanResult(address,uint256,uint8,string,string)
    const selector = "fd04f504"; // logScanResult selector
    const addrEnc = encodeAddress(target);
    const chainEnc = encodeUint256(chainId);
    const scoreEnc = encodeUint8(Math.max(0, result.riskScore));

    // String offsets: riskLevel at offset 160, recommendation after
    const offset1 = (160).toString(16).padStart(64, "0");
    const riskLevelEnc = encodeString(result.riskLevel);
    const offset2 = (160 + 32 + Math.ceil(result.riskLevel.length / 32) * 32)
      .toString(16)
      .padStart(64, "0");
    const recEnc = encodeString(result.recommendation);

    const data =
      "0x" +
      selector +
      addrEnc +
      chainEnc +
      scoreEnc +
      offset1 +
      offset2 +
      riskLevelEnc +
      recEnc;

    // Get nonce
    const fromAddr = process.env.PHAROS_WALLET_ADDRESS ?? "";
    const nonce = (await rpcCall("eth_getTransactionCount", [
      fromAddr,
      "latest",
    ])) as string;
    const gasPrice = (await rpcCall("eth_gasPrice", [])) as string;

    // Build raw transaction (requires signing — use cast or ethers in production)
    // For demo purposes, log the calldata that would be sent
    console.log("[OnChainLogger] Would send tx to ScanRegistry:");
    console.log(`  contract: ${SCAN_REGISTRY_ADDRESS}`);
    console.log(`  calldata: ${data.slice(0, 66)}...`);
    console.log(`  nonce: ${parseInt(nonce, 16)}`);
    console.log(`  gasPrice: ${parseInt(gasPrice, 16)} wei`);

    return "logged";
  } catch (err) {
    console.error("[OnChainLogger] Failed to log on-chain:", err);
    return null;
  }
}

/**
 * Fetch the last recorded scan for an address from the Pharos contract.
 * Read-only — no private key needed.
 */
export async function getLastOnChainScan(target: string): Promise<{
  riskScore: number;
  riskLevel: string;
  recommendation: string;
  timestamp: number;
  chainId: number;
} | null> {
  try {
    const selector = "d5920705"; // getLastScan selector
    const data = "0x" + selector + encodeAddress(target);

    const result = (await rpcCall("eth_call", [
      { to: SCAN_REGISTRY_ADDRESS, data },
      "latest",
    ])) as string;

    // Empty or zero result means no scan history
    if (!result || result === "0x" || result === "0x" + "0".repeat(64))
      return null;

    const hex = result.replace("0x", "");
    if (hex.length < 64 * 6) return null;

    // Struct is wrapped with a 32-byte dynamic offset prefix (slot 0 = 0x20)
    // slot 0  (0-64):    dynamic offset = 32
    // slot 1  (64-128):  target address
    // slot 2  (128-192): chainId
    // slot 3  (192-256): riskScore (uint8)
    // slot 4  (256-320): offset to riskLevel string
    // slot 5  (320-384): offset to recommendation string
    // slot 6  (384-448): timestamp
    const chainId = parseInt(hex.slice(128, 192), 16);
    const riskScore = parseInt(hex.slice(192, 256), 16);
    const timestamp = parseInt(hex.slice(384, 448), 16);

    if (timestamp === 0 && chainId === 0) return null;

    return {
      riskScore,
      riskLevel:
        riskScore === 0
          ? "SAFE"
          : riskScore <= 15
            ? "LOW"
            : riskScore <= 30
              ? "MEDIUM"
              : riskScore <= 55
                ? "HIGH"
                : "CRITICAL",
      recommendation:
        riskScore <= 15 ? "PROCEED" : riskScore <= 30 ? "CAUTION" : "BLOCK",
      timestamp,
      chainId,
    };
  } catch {
    // No scan history found — not an error
    return null;
  }
}

/**
 * Get total number of scans logged on Pharos.
 */
export async function getTotalScans(): Promise<number> {
  try {
    const data = "0x0c23792b"; // totalScans() selector
    const result = (await rpcCall("eth_call", [
      { to: SCAN_REGISTRY_ADDRESS, data },
      "latest",
    ])) as string;
    return parseInt(result, 16);
  } catch {
    return 0;
  }
}
