export type StateCode =
  | "CA"
  | "WA"
  | "OR"
  | "TX"
  | "MA"
  | "MI"
  | "WI"
  | "MN"
  | "NJ"
  | "NY"
  | string;

export type LocationScore = {
  id: string; // e.g. \"CA|Bay Area\" or \"TX|Austin\"
  state: StateCode;
  label: string; // human-readable name like \"SF Bay Area, CA\"
  totalScore: number; // 0–100
  educationScore: number;
  financialScore: number;
  strViabilityScore: number;
  lifestyleScore: number;
  // Short explanations for UI expansion
  educationNotes?: string;
  financialNotes?: string;
  strNotes?: string;
  lifestyleNotes?: string;
  overallNotes?: string;
};

export type LocationScoresResponse = {
  locations: LocationScore[];
};

