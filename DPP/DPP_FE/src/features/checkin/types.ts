export type CheckinPattern = {
  candidate_id: string;
  label: string;
  observation: string;
  interpretation: string;
  evidence: {
    metrics_used: string[];
    numbers: number[];
  };
  tags: string[];
};

export type KPTChoice = "keep" | "problem" | "try";

export type SelectedPattern = {
  candidate_id: string;
  label: string;
  kpt: KPTChoice;
};
