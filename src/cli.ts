#!/usr/bin/env node
/**
 * CLI runner for ContractRiskScanner
 *
 * Usage:
 *   npx ts-node src/cli.ts <address> <chainId> [checkType]
 *
 * Examples:
 *   npx ts-node src/cli.ts 0x6b175474e89094c44da98b954eedeac495271d0f 1 both
 *   npx ts-node src/cli.ts 0xdeadbeef... 56 token
 */

import { run } from "./index";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "\x1b[31m", // red
  high: "\x1b[33m", // yellow
  medium: "\x1b[36m", // cyan
  low: "\x1b[37m", // white
};
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";

function colorForLevel(level: string): string {
  if (level === "SAFE") return GREEN;
  if (level === "LOW") return GREEN;
  if (level === "MEDIUM") return YELLOW;
  return RED;
}

async function main() {
  const [, , address, chainId, checkType] = process.argv;

  if (!address || !chainId) {
    console.error(
      "Usage: ts-node src/cli.ts <address> <chainId> [token|address|both]",
    );
    process.exit(1);
  }

  console.log(`\n${BOLD}ContractRiskScanner${RESET} — Pharos/Anvita Skill`);
  console.log("─".repeat(50));
  console.log(`Address  : ${address}`);
  console.log(`Chain ID : ${chainId}`);
  console.log(`Check    : ${checkType ?? "both"}`);
  console.log("─".repeat(50));
  console.log("Scanning...\n");

  const result = await run({
    address,
    chainId,
    checkType: (checkType as "token" | "address" | "both") ?? "both",
  });

  const levelColor = colorForLevel(result.riskLevel);

  console.log(
    `${BOLD}Risk Score   :${RESET} ${levelColor}${result.riskScore}/100${RESET}`,
  );
  console.log(
    `${BOLD}Risk Level   :${RESET} ${levelColor}${BOLD}${result.riskLevel}${RESET}`,
  );
  console.log(
    `${BOLD}Recommendation:${RESET} ${levelColor}${BOLD}${result.recommendation}${RESET}`,
  );
  console.log();

  if (result.flags.length === 0) {
    console.log(`${GREEN}✓ No risk flags detected${RESET}`);
  } else {
    console.log(`${BOLD}Risk Flags (${result.flags.length}):${RESET}`);
    for (const flag of result.flags) {
      const col = SEVERITY_COLORS[flag.severity] ?? RESET;
      const icon =
        flag.severity === "critical"
          ? "✗"
          : flag.severity === "high"
            ? "⚠"
            : "•";
      console.log(
        `  ${col}${icon} [${flag.severity.toUpperCase()}] ${flag.message}${RESET}`,
      );
      console.log(
        `    ${"\x1b[2m"}id: ${flag.id} | source: ${flag.source}${RESET}`,
      );
    }
  }

  console.log();
  console.log(`${BOLD}Details:${RESET}`);
  console.log(JSON.stringify(result.details, null, 2));
  console.log("─".repeat(50));
  console.log(`\nFull JSON output:`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
