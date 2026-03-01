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

export interface ProductInfo {
  brand: string;
  product: string;
  sku: string | null;
  homeRegion: string;
  homeFlag: string;
  homeCurrency: string;
  homePrice: number | null;
  homePriceLabel: string | null;
  officialUrl: string;
  confidence: string;
}
