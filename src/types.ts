export type SupportedLanguage = "python" | "html" | "markdown" | "text";
export type ExtractionKind = "parsed" | "recovered" | "fallback";
export type TrustLevel = "high" | "medium" | "low";
export type ResultConfidence = "exact" | "strong" | "related" | "fallback";
export type MatchReason =
  | "exact_symbol_name"
  | "normalized_symbol_name"
  | "path_concept"
  | "signature_text"
  | "doc_text"
  | "body_text"
  | "token_overlap"
  | "heading_text"
  | "import_reference"
  | "fallback_file";

export type SymbolRecord = {
  path: string;
  language: SupportedLanguage;
  kind: string;
  name: string;
  signature: string | null;
  body: string;
  doc: string | null;
  fallback: boolean;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type QueryResult = {
  id: number;
  path: string;
  language: SupportedLanguage;
  kind: string;
  name: string;
  signature: string | null;
  doc: string | null;
  distance: number;
  confidence: ResultConfidence;
  matchReason: MatchReason;
  extraction: ExtractionKind;
  trustLevel: TrustLevel;
  fallback: boolean;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  snippet: string;
};

export type SymbolDetails = {
  id: number;
  path: string;
  language: SupportedLanguage;
  kind: string;
  name: string;
  signature: string | null;
  body: string;
  doc: string | null;
  extraction: ExtractionKind;
  trustLevel: TrustLevel;
  fallback: boolean;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type SymbolLookupOptions = {
  kinds?: string[];
};

export type QueryIntentOptions = {
  codeOnly?: boolean;
  docsOnly?: boolean;
  excludeTests?: boolean;
  preferImplementation?: boolean;
};

export type RelationDetails = {
  kind: "imports" | "contained_in";
  targetPath: string | null;
  targetLabel: string;
};

export type RelatedSymbol = {
  relation: RelationDetails;
  symbol: SymbolDetails;
};
