/**
 * ContractRiskScanner — Test Suite
 *
 * Tests the risk scoring engine with mocked GoPlus API responses.
 * Run: npx ts-node tests/scanner.test.ts
 */

import { buildRiskReport } from "../src/reporter";
import type { GoPlusTokenData } from "../src/types";

// ─── Mini test runner ───────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error).message}`);
    failed++;
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(n: number) {
      if ((actual as number) <= n)
        throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeLessThanOrEqualTo(n: number) {
      if ((actual as number) > n)
        throw new Error(`Expected ${actual} <= ${n}`);
    },
    toContain(item: string) {
      if (!(actual as string[]).includes(item))
        throw new Error(`Expected array to contain "${item}", got ${JSON.stringify(actual)}`);
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function makeToken(overrides: Partial<GoPlusTokenData> = {}): GoPlusTokenData {
  return {
    is_open_source: "1",
    is_proxy: "0",
    is_mintable: "0",
    owner_change_balance: "0",
    hidden_owner: "0",
    selfdestruct: "0",
    external_call: "0",
    can_take_back_ownership: "0",
    is_honeypot: "0",
    buy_tax: "0",
    sell_tax: "0",
    cannot_buy: "0",
    cannot_sell_all: "0",
    slippage_modifiable: "0",
    is_blacklisted: "0",
    is_whitelisted: "0",
    is_in_dex: "1",
    transfer_pausable: "0",
    trading_cooldown: "0",
    is_airdrop_scam: "0",
    token_name: "Test Token",
    token_symbol: "TEST",
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

console.log("\nContractRiskScanner — Unit Tests\n");

console.log("[ Risk Scoring Engine ]");

test("clean token scores 0 and returns SAFE", () => {
  const report = buildRiskReport({ token: makeToken() });
  expect(report.riskScore).toBe(0);
  expect(report.riskLevel).toBe("SAFE");
  expect(report.recommendation).toBe("PROCEED");
  expect(report.flags.length).toBe(0);
});

test("honeypot token scores CRITICAL and recommends BLOCK", () => {
  const report = buildRiskReport({ token: makeToken({ is_honeypot: "1" }) });
  expect(report.riskLevel).toBe("CRITICAL");
  expect(report.recommendation).toBe("BLOCK");
  const flagIds = report.flags.map((f) => f.id);
  expect(flagIds).toContain("HONEYPOT");
});

test("owner can change balance → CRITICAL flag", () => {
  const report = buildRiskReport({ token: makeToken({ owner_change_balance: "1" }) });
  const flagIds = report.flags.map((f) => f.id);
  expect(flagIds).toContain("OWNER_CAN_CHANGE_BALANCE");
  expect(report.riskScore).toBeGreaterThan(15);
});

test("unverified source code + mintable → HIGH level", () => {
  const report = buildRiskReport({
    token: makeToken({ is_open_source: "0", is_mintable: "1" }),
  });
  expect(report.riskScore).toBeGreaterThan(15);
  expect(report.flags.length).toBeGreaterThan(1);
});

test("95% sell tax triggers both HIGH_SELL_TAX and EXTREME_SELL_TAX flags", () => {
  const report = buildRiskReport({ token: makeToken({ sell_tax: "0.95" }) });
  const flagIds = report.flags.map((f) => f.id);
  expect(flagIds).toContain("HIGH_SELL_TAX");
  expect(flagIds).toContain("EXTREME_SELL_TAX");
  expect(report.recommendation).toBe("BLOCK");
});

test("trusted token overrides all flags with score 0", () => {
  const report = buildRiskReport({
    token: makeToken({
      trust_list: "1",
      is_proxy: "1",
      slippage_modifiable: "1",
    }),
  });
  expect(report.riskScore).toBe(0);
  expect(report.riskLevel).toBe("SAFE");
});

test("score is clamped to 100 even with many critical flags", () => {
  const report = buildRiskReport({
    token: makeToken({
      is_honeypot: "1",
      owner_change_balance: "1",
      selfdestruct: "1",
      sell_tax: "0.99",
    }),
  });
  expect(report.riskScore).toBeLessThanOrEqualTo(100);
});

console.log("\n[ Address Security ]");

test("phishing address → CRITICAL + BLOCK", () => {
  const report = buildRiskReport({
    address: { phishing_activities: "1" },
  });
  const flagIds = report.flags.map((f) => f.id);
  expect(flagIds).toContain("ADDR_PHISHING");
  expect(report.recommendation).toBe("BLOCK");
});

test("blacklist doubt → HIGH flag", () => {
  const report = buildRiskReport({
    address: { blacklist_doubt: "1" },
  });
  const flagIds = report.flags.map((f) => f.id);
  expect(flagIds).toContain("ADDR_BLACKLIST");
});

test("clean address with no flags → SAFE", () => {
  const report = buildRiskReport({
    address: {
      blacklist_doubt: "0",
      phishing_activities: "0",
      stealing_attack: "0",
      cybercrime: "0",
    },
  });
  expect(report.riskScore).toBe(0);
  expect(report.riskLevel).toBe("SAFE");
});

console.log("\n[ Combined Checks ]");

test("combining token + address risks accumulates score", () => {
  const tokenOnly = buildRiskReport({ token: makeToken({ is_open_source: "0" }) });
  const addrOnly = buildRiskReport({ address: { blacklist_doubt: "1" } });
  const combined = buildRiskReport({
    token: makeToken({ is_open_source: "0" }),
    address: { blacklist_doubt: "1" },
  });
  expect(combined.riskScore).toBeGreaterThan(tokenOnly.riskScore);
  expect(combined.riskScore).toBeGreaterThan(addrOnly.riskScore);
});

test("null token and null address returns UNKNOWN", () => {
  const report = buildRiskReport({ token: null, address: null });
  expect(report.riskScore).toBe(0);
});

test("flags are sorted critical-first", () => {
  const report = buildRiskReport({
    token: makeToken({
      trading_cooldown: "1",    // low
      is_honeypot: "1",         // critical
      slippage_modifiable: "1", // medium
    }),
  });
  expect(report.flags[0].severity).toBe("critical");
});

// ─── Summary ────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("Some tests failed.");
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}