import type {
  GoPlusAddressResponse,
  GoPlusTokenData,
  RiskFlag,
  SkillOutput,
} from "./types";

// Each rule: { id, severity, message, weight, check }
// weight contributes to riskScore (0-100)
interface TokenRule {
  id: string;
  severity: RiskFlag["severity"];
  message: string;
  weight: number;
  check: (data: GoPlusTokenData) => boolean;
}

interface AddressRule {
  id: string;
  severity: RiskFlag["severity"];
  message: string;
  weight: number;
  check: (data: GoPlusAddressResponse["result"]) => boolean;
}

const TOKEN_RULES: TokenRule[] = [
  {
    id: "HONEYPOT",
    severity: "critical",
    message: "Token is a honeypot — you can buy but cannot sell",
    weight: 60,
    check: (d) => d.is_honeypot === "1",
  },
  {
    id: "NOT_OPEN_SOURCE",
    severity: "high",
    message: "Contract source code is not verified/open source",
    weight: 20,
    check: (d) => d.is_open_source === "0",
  },
  {
    id: "HIDDEN_OWNER",
    severity: "high",
    message: "Contract has a hidden owner — ownership can be reclaimed",
    weight: 25,
    check: (d) => d.hidden_owner === "1",
  },
  {
    id: "CAN_TAKE_BACK_OWNERSHIP",
    severity: "high",
    message: "Owner can reclaim contract ownership at any time",
    weight: 20,
    check: (d) => d.can_take_back_ownership === "1",
  },
  {
    id: "MINTABLE",
    severity: "high",
    message: "Owner can mint unlimited new tokens (inflation risk)",
    weight: 20,
    check: (d) => d.is_mintable === "1",
  },
  {
    id: "OWNER_CAN_CHANGE_BALANCE",
    severity: "critical",
    message: "Owner can directly modify holder balances",
    weight: 40,
    check: (d) => d.owner_change_balance === "1",
  },
  {
    id: "SELFDESTRUCT",
    severity: "critical",
    message: "Contract can self-destruct, destroying all funds",
    weight: 40,
    check: (d) => d.selfdestruct === "1",
  },
  {
    id: "HIGH_BUY_TAX",
    severity: "high",
    message: `Buy tax exceeds 10%`,
    weight: 15,
    check: (d) => parseFloat(d.buy_tax ?? "0") > 0.1,
  },
  {
    id: "HIGH_SELL_TAX",
    severity: "high",
    message: `Sell tax exceeds 10%`,
    weight: 20,
    check: (d) => parseFloat(d.sell_tax ?? "0") > 0.1,
  },
  {
    id: "EXTREME_SELL_TAX",
    severity: "critical",
    message: `Sell tax is above 50% — effectively a honeypot`,
    weight: 50,
    check: (d) => parseFloat(d.sell_tax ?? "0") > 0.5,
  },
  {
    id: "CANNOT_BUY",
    severity: "critical",
    message: "Token cannot currently be purchased",
    weight: 30,
    check: (d) => d.cannot_buy === "1",
  },
  {
    id: "CANNOT_SELL_ALL",
    severity: "high",
    message: "Holders cannot sell their entire balance at once",
    weight: 20,
    check: (d) => d.cannot_sell_all === "1",
  },
  {
    id: "TRANSFER_PAUSABLE",
    severity: "high",
    message: "Transfers can be paused by the owner",
    weight: 15,
    check: (d) => d.transfer_pausable === "1",
  },
  {
    id: "SLIPPAGE_MODIFIABLE",
    severity: "medium",
    message: "Owner can modify slippage tolerance for trades",
    weight: 10,
    check: (d) => d.slippage_modifiable === "1",
  },
  {
    id: "IS_BLACKLISTED",
    severity: "medium",
    message: "Contract uses a blacklist (owner can block specific wallets)",
    weight: 10,
    check: (d) => d.is_blacklisted === "1",
  },
  {
    id: "PROXY_CONTRACT",
    severity: "medium",
    message: "Contract is a proxy — logic can be upgraded/replaced",
    weight: 10,
    check: (d) => d.is_proxy === "1",
  },
  {
    id: "AIRDROP_SCAM",
    severity: "high",
    message: "Token is flagged as an airdrop scam",
    weight: 35,
    check: (d) => d.is_airdrop_scam === "1",
  },
  {
    id: "EXTERNAL_CALL",
    severity: "medium",
    message: "Contract makes external calls during transfer (re-entrancy risk)",
    weight: 12,
    check: (d) => d.external_call === "1",
  },
  {
    id: "TRADING_COOLDOWN",
    severity: "low",
    message: "Token enforces a trading cooldown between transactions",
    weight: 5,
    check: (d) => d.trading_cooldown === "1",
  },
];

const ADDRESS_RULES: AddressRule[] = [
  {
    id: "ADDR_PHISHING",
    severity: "critical",
    message: "Address is flagged for phishing activities",
    weight: 60,
    check: (d) => d.phishing_activities === "1",
  },
  {
    id: "ADDR_BLACKLIST",
    severity: "high",
    message: "Address appears on security blacklists",
    weight: 30,
    check: (d) => d.blacklist_doubt === "1",
  },
  {
    id: "ADDR_HONEYPOT_RELATED",
    severity: "critical",
    message: "Address is associated with known honeypot contracts",
    weight: 50,
    check: (d) => d.honeypot_related_address === "1",
  },
  {
    id: "ADDR_BLACKMAIL",
    severity: "critical",
    message: "Address is flagged for blackmail/extortion activities",
    weight: 60,
    check: (d) => d.blackmail_activities === "1",
  },
  {
    id: "ADDR_STEALING",
    severity: "critical",
    message: "Address is associated with stealing/theft attacks",
    weight: 60,
    check: (d) => d.stealing_attack === "1",
  },
  {
    id: "ADDR_FAKE_KYC",
    severity: "high",
    message: "Address is linked to fake KYC schemes",
    weight: 40,
    check: (d) => d.fake_kyc === "1",
  },
  {
    id: "ADDR_DARKWEB",
    severity: "critical",
    message: "Address has dark web transaction history",
    weight: 50,
    check: (d) => d.darkweb_transactions === "1",
  },
  {
    id: "ADDR_CYBERCRIME",
    severity: "critical",
    message: "Address is linked to cybercrime activity",
    weight: 60,
    check: (d) => d.cybercrime === "1",
  },
  {
    id: "ADDR_MONEY_LAUNDERING",
    severity: "critical",
    message: "Address is flagged for money laundering",
    weight: 55,
    check: (d) => d.money_laundering === "1",
  },
  {
    id: "ADDR_FINANCIAL_CRIME",
    severity: "critical",
    message: "Address is associated with financial crime",
    weight: 55,
    check: (d) => d.financial_crime === "1",
  },
  {
    id: "ADDR_MALICIOUS_MINING",
    severity: "high",
    message: "Address is linked to malicious mining operations",
    weight: 30,
    check: (d) => d.malicious_mining_activities === "1",
  },
];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function scoreToLevel(score: number): SkillOutput["riskLevel"] {
  if (score === 0) return "SAFE";
  if (score <= 15) return "LOW";
  if (score <= 30) return "MEDIUM";
  if (score <= 55) return "HIGH";
  return "CRITICAL";
}

function levelToRecommendation(level: SkillOutput["riskLevel"]): SkillOutput["recommendation"] {
  if (level === "SAFE" || level === "LOW") return "PROCEED";
  if (level === "MEDIUM") return "CAUTION";
  return "BLOCK";
}

export function buildRiskReport(
  results: Record<string, unknown>
): SkillOutput {
  const flags: RiskFlag[] = [];
  let rawScore = 0;
  const details: Record<string, unknown> = {};

  const tokenData = results.token as GoPlusTokenData | null | undefined;
  const addressData = results.address as GoPlusAddressResponse["result"] | null | undefined;

  // --- Token checks ---
  if (tokenData) {
    details.token = {
      name: tokenData.token_name,
      symbol: tokenData.token_symbol,
      totalSupply: tokenData.total_supply,
      holderCount: tokenData.holder_count,
      buyTax: tokenData.buy_tax ? `${(parseFloat(tokenData.buy_tax) * 100).toFixed(1)}%` : "unknown",
      sellTax: tokenData.sell_tax ? `${(parseFloat(tokenData.sell_tax) * 100).toFixed(1)}%` : "unknown",
      isInDex: tokenData.is_in_dex === "1",
      isTrusted: tokenData.trust_list === "1",
      creatorAddress: tokenData.creator_address,
      ownerAddress: tokenData.owner_address,
    };

    for (const rule of TOKEN_RULES) {
      if (rule.check(tokenData)) {
        flags.push({
          id: rule.id,
          severity: rule.severity,
          message: rule.message,
          source: "token_security",
        });
        rawScore += rule.weight;
      }
    }

    // Trust list overrides everything if explicitly trusted
    if (tokenData.trust_list === "1") {
      rawScore = 0;
    }
  } else {
    details.tokenNote = "Token security data unavailable (not an ERC-20 or API limit reached)";
  }

  // --- Address checks ---
  if (addressData) {
    details.address = { dataSource: addressData.data_source };

    for (const rule of ADDRESS_RULES) {
      if (rule.check(addressData)) {
        flags.push({
          id: rule.id,
          severity: rule.severity,
          message: rule.message,
          source: "address_security",
        });
        rawScore += rule.weight;
      }
    }
  } else {
    details.addressNote = "Address security data unavailable or API limit reached";
  }

  const riskScore = clamp(rawScore, 0, 100);
  const riskLevel = scoreToLevel(riskScore);
  const recommendation = levelToRecommendation(riskLevel);

  // Sort flags: critical first
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { riskScore, riskLevel, flags, recommendation, details };
}