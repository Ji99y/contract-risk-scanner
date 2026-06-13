/**
 * approvalChecker.ts
 *
 * Feature #2 — Token Approval Risk Check
 *
 * Checks if a wallet address has dangerous token approvals outstanding.
 * Uses GoPlus Approval Security API.
 *
 * Common attack: user approved a malicious contract to spend unlimited tokens.
 * This check surfaces those risks before an agent interacts with a wallet.
 */

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const REQUEST_TIMEOUT_MS = 10_000;

export interface ApprovalRisk {
  tokenAddress: string;
  tokenSymbol: string;
  spenderAddress: string;
  spenderName: string;
  approvalValue: string; // "Unlimited" or amount
  isRisky: boolean;
  riskReason: string;
}

export interface ApprovalCheckResult {
  hasRiskyApprovals: boolean;
  riskyCount: number;
  totalApprovals: number;
  approvals: ApprovalRisk[];
}

export async function checkApprovals(
  walletAddress: string,
  chainId: string | number
): Promise<ApprovalCheckResult | null> {
  const url = `${GOPLUS_BASE}/approval_security/${chainId}?addresses=${walletAddress.toLowerCase()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[ApprovalChecker] API error: ${res.status}`);
      return null;
    }

    const json = await res.json() as {
      code: number;
      message: string;
      result?: Array<{
        token_address?: string;
        token_symbol?: string;
        approved_list?: Array<{
          approved_contract?: string;
          approved_contract_name?: string;
          approved_amount?: string;
          is_contract?: string;
          tag?: string;
        }>;
      }>;
    };

    if (json.code !== 1 || !json.result) return null;

    const approvals: ApprovalRisk[] = [];

    for (const token of json.result) {
      for (const approval of token.approved_list ?? []) {
        const isUnlimited = approval.approved_amount === "Unlimited" ||
          BigInt(approval.approved_amount ?? "0") > BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935") / BigInt(2);

        const isRisky = isUnlimited || !approval.is_contract || approval.tag === "risky";

        approvals.push({
          tokenAddress: token.token_address ?? "",
          tokenSymbol: token.token_symbol ?? "UNKNOWN",
          spenderAddress: approval.approved_contract ?? "",
          spenderName: approval.approved_contract_name ?? "Unknown contract",
          approvalValue: approval.approved_amount === "Unlimited" ? "Unlimited" : approval.approved_amount ?? "0",
          isRisky,
          riskReason: isUnlimited
            ? "Unlimited approval — spender can drain entire token balance"
            : !approval.is_contract
            ? "Approved to an EOA (non-contract address)"
            : "Flagged as risky by GoPlus",
        });
      }
    }

    const riskyApprovals = approvals.filter(a => a.isRisky);

    return {
      hasRiskyApprovals: riskyApprovals.length > 0,
      riskyCount: riskyApprovals.length,
      totalApprovals: approvals.length,
      approvals,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[ApprovalChecker] Request timed out");
    } else {
      console.error("[ApprovalChecker] Fetch failed:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}