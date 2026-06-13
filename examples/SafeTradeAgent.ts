/**
 * SafeTradeAgent.ts — Example Pharos Agent (Phase 2 Preview)
 *
 * Demonstrates the full value chain:
 *   ContractRiskScanner Skill → Security Gate → Trade Execution
 *
 * This agent refuses to execute any swap unless the target token
 * passes the ContractRiskScanner check first.
 *
 * Usage:
 *   npx ts-node examples/SafeTradeAgent.ts <tokenAddress> <chainId> <amount>
 *
 * Example:
 *   npx ts-node examples/SafeTradeAgent.ts 0x6b175474e89094c44da98b954eedeac495271d0f 1 100
 */

import { run, runApprovalCheck, getLastOnChainScan } from "../src/index";

// ── Config ───────────────────────────────────────────────────────────────────

const AGENT_CONFIG = {
  name: "SafeTradeAgent",
  version: "1.0.0",
  maxRiskScore: 30, // Block anything above MEDIUM
  requireOpenSource: true,
  blockOnHoneypot: true,
  checkApprovals: true,
  logOnChain: true,
};

// ── Types ────────────────────────────────────────────────────────────────────

interface TradeRequest {
  tokenAddress: string;
  chainId: number;
  amount: number;
  walletAddress?: string;
}

interface TradeDecision {
  approved: boolean;
  reason: string;
  riskScore: number;
  riskLevel: string;
  flags: string[];
  onChainHistory?: {
    lastScanned: string;
    previousRiskScore: number;
  } | null;
}

// ── Agent ────────────────────────────────────────────────────────────────────

async function evaluateTrade(request: TradeRequest): Promise<TradeDecision> {
  const { tokenAddress, chainId, amount, walletAddress } = request;

  console.log(`\n[${AGENT_CONFIG.name}] Evaluating trade request`);
  console.log(`  Token   : ${tokenAddress}`);
  console.log(`  Chain   : ${chainId}`);
  console.log(`  Amount  : ${amount}`);
  console.log(`  Wallet  : ${walletAddress ?? "not specified"}`);
  console.log("─".repeat(50));

  // ── Step 1: Check on-chain history first (fast, no API call) ──────────────
  console.log("[1/4] Checking on-chain scan history...");
  let onChainHistory = null;
  try {
    const lastScan = await getLastOnChainScan(tokenAddress);
    if (lastScan && lastScan.timestamp > 0) {
      const age = Math.floor((Date.now() / 1000 - lastScan.timestamp) / 60);
      console.log(
        `  Found previous scan: ${lastScan.riskLevel} (${age} minutes ago)`,
      );
      onChainHistory = {
        lastScanned: new Date(lastScan.timestamp * 1000).toISOString(),
        previousRiskScore: lastScan.riskScore,
      };
    } else {
      console.log("  No previous on-chain scan found — running fresh scan");
    }
  } catch {
    console.log("  On-chain history unavailable — continuing with fresh scan");
  }

  // ── Step 2: Run ContractRiskScanner Skill ─────────────────────────────────
  console.log("[2/4] Running ContractRiskScanner...");
  const scanResult = await run({
    address: tokenAddress,
    chainId,
    checkType: "both",
  });

  console.log(`  Risk Score : ${scanResult.riskScore}/100`);
  console.log(`  Risk Level : ${scanResult.riskLevel}`);
  console.log(`  Verdict    : ${scanResult.recommendation}`);

  if (scanResult.flags.length > 0) {
    console.log(`  Flags (${scanResult.flags.length}):`);
    for (const flag of scanResult.flags.slice(0, 3)) {
      console.log(`    ⚠ [${flag.severity}] ${flag.message}`);
    }
  }

  // ── Step 3: Check wallet approvals if provided ────────────────────────────
  let approvalRisk = false;
  if (walletAddress && AGENT_CONFIG.checkApprovals) {
    console.log("[3/4] Checking wallet approval risks...");
    const approvals = await runApprovalCheck(walletAddress, chainId);
    if (approvals) {
      console.log(`  Total approvals : ${approvals.totalApprovals}`);
      console.log(`  Risky approvals : ${approvals.riskyCount}`);
      if (approvals.hasRiskyApprovals) {
        approvalRisk = true;
        console.log("  ⚠ Wallet has risky approvals outstanding");
        for (const a of approvals.approvals
          .filter((x) => x.isRisky)
          .slice(0, 2)) {
          console.log(
            `    - ${a.tokenSymbol}: ${a.approvalValue} approved to ${a.spenderName}`,
          );
        }
      }
    }
  } else {
    console.log("[3/4] Skipping approval check (no wallet address provided)");
  }

  // ── Step 4: Make trade decision ───────────────────────────────────────────
  console.log("[4/4] Making trade decision...");

  const flags = scanResult.flags.map((f) => f.id);
  let approved = true;
  let reason = "All security checks passed";

  if (scanResult.riskScore > AGENT_CONFIG.maxRiskScore) {
    approved = false;
    reason = `Risk score ${scanResult.riskScore} exceeds agent limit of ${AGENT_CONFIG.maxRiskScore}`;
  } else if (flags.includes("HONEYPOT")) {
    approved = false;
    reason = "BLOCKED: Token is a honeypot — cannot sell after buying";
  } else if (flags.includes("SELFDESTRUCT")) {
    approved = false;
    reason = "BLOCKED: Contract can self-destruct";
  } else if (flags.includes("OWNER_CAN_CHANGE_BALANCE")) {
    approved = false;
    reason = "BLOCKED: Owner can modify holder balances";
  } else if (scanResult.recommendation === "BLOCK") {
    approved = false;
    reason = `BLOCKED: ${scanResult.flags[0]?.message ?? "Critical risk detected"}`;
  } else if (approvalRisk) {
    approved = false;
    reason =
      "BLOCKED: Wallet has dangerous token approvals — revoke before trading";
  }

  return {
    approved,
    reason,
    riskScore: scanResult.riskScore,
    riskLevel: scanResult.riskLevel,
    flags,
    onChainHistory,
  };
}

async function executeTrade(request: TradeRequest): Promise<void> {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`${AGENT_CONFIG.name} v${AGENT_CONFIG.version}`);
  console.log(`${"═".repeat(50)}`);

  const decision = await evaluateTrade(request);

  console.log(`\n${"─".repeat(50)}`);
  console.log("TRADE DECISION");
  console.log(`${"─".repeat(50)}`);

  if (decision.approved) {
    console.log(`✅ APPROVED — ${decision.reason}`);
    console.log(`   Risk: ${decision.riskLevel} (${decision.riskScore}/100)`);
    console.log("\n[Agent] Executing swap...");
    console.log("[Agent] ✓ Swap submitted successfully (simulated)");
    console.log(
      "[Agent] Transaction would be signed and broadcast here in production",
    );
  } else {
    console.log(`🚫 REJECTED — ${decision.reason}`);
    console.log(`   Risk: ${decision.riskLevel} (${decision.riskScore}/100)`);
    if (decision.flags.length > 0) {
      console.log(`   Flags: ${decision.flags.slice(0, 3).join(", ")}`);
    }
    console.log("\n[Agent] Trade blocked. Protecting user funds.");
  }

  if (decision.onChainHistory) {
    console.log(
      `\n[Agent] On-chain history: previously scanned at ${decision.onChainHistory.lastScanned}`,
    );
    console.log(
      `         Previous risk score: ${decision.onChainHistory.previousRiskScore}/100`,
    );
  }

  console.log(`${"═".repeat(50)}\n`);
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

async function main() {
  const [, , tokenAddress, chainId, amount, walletAddress] = process.argv;

  if (!tokenAddress || !chainId) {
    console.log(
      "Usage: npx ts-node examples/SafeTradeAgent.ts <tokenAddress> <chainId> [amount] [walletAddress]",
    );
    console.log("\nExamples:");
    console.log("  # Safe token (DAI on Ethereum)");
    console.log(
      "  npx ts-node examples/SafeTradeAgent.ts 0x6b175474e89094c44da98b954eedeac495271d0f 1 100",
    );
    console.log("\n  # Risky token on BSC");
    console.log(
      "  npx ts-node examples/SafeTradeAgent.ts 0x64c37c3d6b5ff0fdea26eec0c8b6de487105291c 56 50",
    );
    process.exit(0);
  }

  await executeTrade({
    tokenAddress,
    chainId: parseInt(chainId),
    amount: parseFloat(amount ?? "0"),
    walletAddress,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
