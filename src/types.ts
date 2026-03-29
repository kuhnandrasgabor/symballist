export type SupportedLanguage = "python" | "html" | "markdown" | "text";

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
  score: number;
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
  fallback: boolean;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type SymbolLookupOptions = {
  kinds?: string[];
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
