export interface RegionPrice {
  region: string;
  flag: string;
  currency: string;
  localPrice: string | null;
  priceNumeric: number | null;
  priceUSD: number | null;
  priceUSDFormatted: string | null;
  exchangeRate: string;
  taxNote: string;
  officialUrl: string;
  confidence: "high" | "medium" | "unavailable";
  notes: string | null;
  isBest?: boolean;
}

export interface PriceResult {
  product: string;
  brand: string;
  confirmedQuery: string;
  regions: RegionPrice[];
  searchedAt: string;
  disclaimer: string;
  bestRegion: string | null;
}

export interface ClarifyQuestion {
  id: string;
  label: string;
  type: "select" | "text";
  options?: string[];
  required: boolean;
}

export interface ClarifyResponse {
  questions: ClarifyQuestion[];
  productSummary: string;
  brand: string;
}
