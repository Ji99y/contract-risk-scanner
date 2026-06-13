# ContractRiskScanner

**A Pharos/Anvita Skill — Phase 1 Hackathon Submission**

Pre-transaction security scanning for any EVM contract or wallet address. Any Agent on Anvita Flow can call this Skill before executing a trade, transfer, or interaction to get an instant risk assessment.

Powered by [GoPlus Security](https://gopluslabs.io/) APIs. No API key required for standard usage.

---

## What It Does

Before an agent sends funds or interacts with a contract, it calls `ContractRiskScanner` with an address and chain ID. The Skill returns:

| Field | Description |
|---|---|
| `riskScore` | 0–100 composite risk score |
| `riskLevel` | `SAFE` / `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| `recommendation` | `PROCEED` / `CAUTION` / `BLOCK` |
| `flags` | Specific risks detected, sorted by severity |
| `details` | Token metadata, address info, and API notes |

### Risk Flags Detected

**Token Security (19 checks)**
- Honeypot detection
- Hidden owner / ownership reclaim
- Mintable supply
- Owner can modify balances
- Self-destruct capability
- Buy/sell tax analysis (flags >10%, critical at >50%)
- Transfer pause / trading cooldown
- Proxy contract (upgradeable logic)
- Airdrop scam detection
- Blacklist/whitelist usage
- External call re-entrancy risk

**Address Security (11 checks)**
- Phishing activity
- Blacklist membership
- Honeypot-related address
- Blackmail / extortion
- Theft / stealing attacks
- Fake KYC schemes
- Dark web transactions
- Cybercrime links
- Money laundering
- Financial crime
- Malicious mining

---

## Quick Start

```bash
git clone <repo>
cd contract-risk-scanner
npm install

# Scan a token (DAI on Ethereum)
npm run scan 0x6b175474e89094c44da98b954eedeac495271d0f 1 token

# Scan a wallet address on BSC
npm run scan 0xYourAddress 56 address

# Run both checks
npm run scan 0xYourAddress 1 both
```

### Example Output

```
ContractRiskScanner — Pharos/Anvita Skill
──────────────────────────────────────────
Address  : 0x6b175474e89094c44da98b954eedeac495271d0f
Chain ID : 1
Check    : token
──────────────────────────────────────────
Scanning...

Risk Score   : 0/100
Risk Level   : SAFE
Recommendation: PROCEED

✓ No risk flags detected
```

---

## Calling From an Agent

```typescript
import { run } from "contract-risk-scanner";

// Inside your agent's pre-trade hook:
const risk = await run({
  address: targetContractAddress,
  chainId: 1,
  checkType: "both",
});

if (risk.recommendation === "BLOCK") {
  throw new Error(`Transaction blocked: ${risk.flags[0].message}`);
}

if (risk.recommendation === "CAUTION") {
  // log flags, notify user, require confirmation
}

// Safe to proceed
await executeTransaction(...);
```

---

## Skill Manifest

See [`skill.manifest.json`](./skill.manifest.json) for the full input/output schema, chain support list, and Anvita integration metadata.

---

## Running Tests

```bash
npm test
```

All 13 unit tests cover:
- Clean token → SAFE
- Honeypot detection → CRITICAL + BLOCK
- Multi-flag scoring and accumulation
- Score clamped to 100
- Trusted token overrides
- Address phishing / blacklist flags
- Combined token + address scoring
- Flag sort order (critical first)

---

## Security Design (CertiK Skill Scanner)

This Skill is designed to pass CertiK Skill Scanner review:

- **No shell execution** — zero `exec`, `spawn`, or `eval` calls
- **No file system access** — reads or writes no local files
- **Minimal network scope** — only calls `api.gopluslabs.io` (the GoPlus API)
- **No secrets in code** — no hardcoded keys or credentials
- **No data leakage** — input data is only sent to GoPlus; nothing else
- **Request timeouts** — all API calls abort after 10 seconds
- **Graceful failure** — null API responses degrade cleanly without throwing

---

## 13 supported chains (including Pharos Mainnet + Testnet)

| Chain | ID |
|---|---|
| Ethereum | 1 |
| BNB Smart Chain | 56 |
| Polygon | 137 |
| Arbitrum One | 42161 |
| Optimism | 10 |
| Avalanche C-Chain | 43114 |
| Base | 8453 |
| Linea | 59144 |
| Scroll | 534352 |
| zkSync Era | 324 |
| Fantom | 250 |
| Pharos Mainnet | 1672 |
| Pharos Testnet | 688688 |

---

## Why This Skill Matters

Most DeFi agents today execute transactions blindly. A honeypot can drain a wallet; a malicious contract can steal approvals; a phishing address can redirect funds silently.

`ContractRiskScanner` gives every agent on Pharos a single, reusable security gate. One call before every transaction. The skill is composable — any agent in Phase 2 can import it in one line.

**Skill Creator → Agent Developer → End User — secured at every step.**

---

## Built For

- Pharos x Anvita Skill-to-Agent Dual Cascade Hackathon (Phase 1)
- Sponsored by Alibaba Cloud, GoPlus Security, CertiK
- Submission deadline: June 15, 2026

## License

MIT