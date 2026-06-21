export type Status = "OPEN" | "UPCOMING" | "CLOSED" | "ROLLING" | "UNKNOWN";

export interface FundingCall {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  programFamily?: string;
  summary?: string;
  status: Status;
  beneficiaryTypes: string[];
  themes: string[];
  geography: string[];
  aidTypes: string[];
  eligibleKad: string[];
  excludedKad: string[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  aidIntensityPct?: number | null;
  totalFund?: number | null;
  opensAt?: string | null;
  deadline?: string | null;
  officialUrl: string;
  docUrls: string[];
  rawHash: string;
}

export interface Profile {
  id: string;
  label: string;
  beneficiaryTypes: string[];
  themes: string[];
  geography: string[];
  kad?: string[];
  notes?: string;
}

export interface Match {
  id: string;
  score: number;
  reasons: string[];
}

export interface Dataset {
  generatedAt: string;
  stats: { total: number; open: number; bySource: Record<string, number> };
  profiles: Profile[];
  calls: FundingCall[];
  matches: Record<string, Match[]>;
}
