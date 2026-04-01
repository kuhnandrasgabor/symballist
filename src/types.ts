export type SupportedLanguage = "python" | "ruby" | "html" | "markdown" | "javascript" | "typescript" | "yaml" | "shell" | "dockerfile" | "css" | "text";
export type ExtractionKind = "parsed" | "recovered" | "fallback";
export type TrustLevel = "high" | "medium" | "low";
export type ResultConfidence = "exact" | "strong" | "related" | "fallback";
export type MatchReason =
  | "exact_symbol_name"
  | "normalized_symbol_name"
  | "path_concept"
  | "semantic_similarity"
  | "signature_text"
  | "doc_text"
  | "body_text"
  | "token_overlap"
  | "heading_text"
  | "import_reference"
  | "fallback_file";

export type RetrievalChannel = "lexical" | "concept_path" | "semantic";
export type HybridContribution = "lexical_only" | "semantic_only" | "semantic_assisted";
export type GraphSignal = "same_file_cluster" | "imports_candidate" | "imported_by_candidate" | "uses_candidate" | "used_by_candidate" | "root_candidate";
export type RetrievalQualityLevel = "strong" | "moderate" | "weak" | "none";
export type RetrievalQualityReason =
  | "top_result_strong"
  | "top_result_semantically_confirmed"
  | "strong_match_present"
  | "related_but_actionable"
  | "only_weak_matches"
  | "no_results";
export type ImpactCommandName = "status" | "index" | "watch" | "lookup" | "query" | "show" | "graph" | "report";
export type ImpactTransitionName =
  | "lookup_to_show"
  | "query_to_show"
  | "lookup_to_graph"
  | "query_to_graph"
  | "weak_result_retry"
  | "lookup_to_full_show"
  | "lookup_to_full_graph";

export type FileReference = {
  path: string;
  language: SupportedLanguage;
};

export type SymbolLocation = {
  path: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type RelationDetails = {
  kind: "imports" | "contained_in" | "uses";
  targetPath: string | null;
  targetLabel: string;
};

export type GraphTraversalKind =
  | "imports"
  | "uses"
  | "contained_in"
  | "imported_by"
  | "used_by"
  | "container";

export type GraphTraversalEntry = {
  traversal: GraphTraversalKind;
  relation: RelationDetails;
  symbol: SymbolDetails;
};

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
  relations?: RelationDetails[];
};

export type QueryResult = {
  id: number;
  path: string;
  file: FileReference;
  location: SymbolLocation;
  language: SupportedLanguage;
  kind: string;
  name: string;
  signature: string | null;
  doc: string | null;
  distance: number;
  score: number | null;
  scoreMarginFromTop: number | null;
  confidence: ResultConfidence;
  matchReason: MatchReason;
  extraction: ExtractionKind;
  trustLevel: TrustLevel;
  retrievalTrustLevel: TrustLevel;
  semanticSimilarity: number | null;
  retrievalChannels: RetrievalChannel[];
  hybridContribution: HybridContribution;
  graphSignals: GraphSignal[];
  graphDiagnostics?: GraphDiagnostics;
  fallback: boolean;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  snippet: string;
};

export type SearchDiagnostics = {
  lexicalCandidates: number;
  conceptCandidates: number;
  semanticCandidatesRetrieved: number;
  semanticCandidatesMerged: number;
  semanticCandidatesRetained: number;
  topResultHasSemanticSignal: boolean;
  topSemanticCandidate: {
    id: number;
    path: string;
    kind: string;
    name: string;
    semanticSimilarity: number;
    retained: boolean;
    resultRank: number | null;
  } | null;
};

export type RetrievalQualitySummary = {
  level: RetrievalQualityLevel;
  reason: RetrievalQualityReason;
  noStrongMatch: boolean;
  strongMatchCount: number;
  resultCount: number;
  topResultConfidence: ResultConfidence | null;
  topResultRetrievalTrustLevel: TrustLevel | null;
};

export type GraphDiagnostics = {
  knownInboundReferences: number;
  knownOutboundReferences: number;
  inboundReferencesFromTestsOnly: boolean;
  sameFileConnectivityOnly: boolean;
  disconnectedFromIndexedGraph: boolean;
  rootLike: boolean;
  possibleOrphanCandidate: boolean;
  possibleOrphanReasons: string[];
  rootReasons: string[];
  notes: string[];
};

export type SymbolDetails = {
  id: number;
  path: string;
  file: FileReference;
  location: SymbolLocation;
  language: SupportedLanguage;
  kind: string;
  name: string;
  signature: string | null;
  body: string;
  doc: string | null;
  graphDiagnostics?: GraphDiagnostics;
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
  excludePaths?: string[];
  preferImplementation?: boolean;
};

export type RelatedSymbol = {
  relation: RelationDetails;
  symbol: SymbolDetails;
};

export type ImpactTrackingSummary = {
  recordedCommands: number;
  recordedInfrastructureCommands: number;
  commandCounts: Record<ImpactCommandName, number>;
  infrastructureCommandCounts: {
    watch: number;
  };
  retrievalModeCounts: {
    lexical: number;
    hybrid: number;
  };
  resultQualityCounts: Record<RetrievalQualityLevel, number>;
  bodyModeCounts: {
    summary: number;
    full: number;
  };
  transitionCounts: Record<ImpactTransitionName, number>;
  workflowSignals: {
    oneShotStrongLookups: number;
    noStrongMatchCount: number;
    fullBodyExpansions: number;
    graphFollowUpsAfterRetrieval: number;
  };
  payloadCharsReturned: number;
  estimatedImpact: {
    avoidedSearchLoops: number;
    avoidedDirectFileReads: number;
  };
  lastCommand: {
    command: ImpactCommandName;
    timestamp: string;
  } | null;
  lastInfrastructureCommand: {
    command: "watch";
    timestamp: string;
  } | null;
};
