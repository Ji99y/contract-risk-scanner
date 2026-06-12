export interface SkillInput {
  address: string;
  chainId: string | number;
  checkType?: "token" | "address" | "both";
}

export interface SkillOutput {
  riskScore: number;
  riskLevel: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
  flags: RiskFlag[];
  recommendation: "PROCEED" | "CAUTION" | "BLOCK";
  details: Record<string, unknown>;
}

export interface RiskFlag {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  source: "token_security" | "address_security";
}

export interface GoPlusTokenResponse {
  code: number;
  message: string;
  result: Record<string, GoPlusTokenData>;
}

export interface GoPlusTokenData {
  // Ownership / control risks
  is_open_source?: "0" | "1";
  is_proxy?: "0" | "1";
  is_mintable?: "0" | "1";
  owner_change_balance?: "0" | "1";
  hidden_owner?: "0" | "1";
  selfdestruct?: "0" | "1";
  external_call?: "0" | "1";
  can_take_back_ownership?: "0" | "1";

  // Trading risks
  is_honeypot?: "0" | "1";
  buy_tax?: string;
  sell_tax?: string;
  cannot_buy?: "0" | "1";
  cannot_sell_all?: "0" | "1";
  slippage_modifiable?: "0" | "1";
  is_blacklisted?: "0" | "1";
  is_whitelisted?: "0" | "1";
  is_in_dex?: "0" | "1";
  transfer_pausable?: "0" | "1";
  trading_cooldown?: "0" | "1";
  personal_slippage_modifiable?: "0" | "1";

  // Holder distribution
  holder_count?: string;
  lp_holder_count?: string;
  lp_total_supply?: string;
  is_true_token?: "0" | "1";
  is_airdrop_scam?: "0" | "1";

  token_name?: string;
  token_symbol?: string;
  total_supply?: string;
  creator_address?: string;
  owner_address?: string;
  trust_list?: "0" | "1";
  other_potential_risks?: string;
  note?: string;
}

export interface GoPlusAddressResponse {
  code: number;
  message: string;
  result: {
    blacklist_doubt?: "0" | "1";
    honeypot_related_address?: "0" | "1";
    phishing_activities?: "0" | "1";
    blackmail_activities?: "0" | "1";
    stealing_attack?: "0" | "1";
    fake_kyc?: "0" | "1";
    malicious_mining_activities?: "0" | "1";
    darkweb_transactions?: "0" | "1";
    cybercrime?: "0" | "1";
    money_laundering?: "0" | "1";
    financial_crime?: "0" | "1";
    contract_address?: "0" | "1";
    data_source?: string;
  };
}