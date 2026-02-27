import type { StateCode } from "./locationScores";

export type ZipSuggestion = {
  zip: string;
  city?: string;
  state: StateCode;
  score: number; // 0–100 overall desirability
  educationNotes?: string;
  strNotes?: string;
  overallNotes?: string;
};

export type ZipSuggestionsResponse = {
  locationId: string;
  state: StateCode;
  label: string;
  zips: ZipSuggestion[];
};

