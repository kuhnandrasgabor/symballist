export type SupportedLanguage = "python" | "html" | "text";

export type SymbolRecord = {
  path: string;
  language: SupportedLanguage;
  kind: string;
  name: string;
  signature: string | null;
  body: string;
  doc: string | null;
  fallback: boolean;
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
};
