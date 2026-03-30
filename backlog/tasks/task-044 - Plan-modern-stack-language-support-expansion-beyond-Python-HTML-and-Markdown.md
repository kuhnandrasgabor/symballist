---
id: TASK-044
title: Plan modern-stack language support expansion beyond Python HTML and Markdown
status: Done
assignee: []
created_date: '2026-03-30 11:33'
updated_date: '2026-03-30 11:36'
labels:
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Symballist currently has first-class extractors for Python, HTML, and Markdown. To support modern mixed-language repos, plan a language-expansion track that adds practical indexing coverage for additional code, config, and ops files without destabilizing current retrieval quality. Treat this as a parallel expansion stream to the general product growth work, with an explicit rollout order, parser strategy, fallback expectations, and testing approach.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A prioritized rollout order exists for modern-stack language support based on user value and implementation cost
- [x] #2 The plan distinguishes full parser-backed symbol extraction from lighter file-level or heading-like fallback support where appropriate
- [x] #3 The expansion track defines concrete follow-up slices for JS/TS, config-ops languages, and harder compiled/runtime ecosystems
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm the current parser-per-language architecture and its extension points.
2. Define a rollout order based on user value, parser complexity, and retrieval-model fit.
3. Split the work into follow-up backlog items by language family and support depth.
4. Keep current retrieval-quality work ahead of broad language expansion when trust/calibration issues affect existing users.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Architecture assessment:
- Current language support is parser-per-language with explicit extension mapping in `src/config.ts`, language dispatch in `src/indexer/index.ts`, and one extractor module per language under `src/indexer/`.
- Storage/search schema is generic enough for new languages, so most expansion cost sits in parser integration, symbol extraction design, fixtures, and retrieval-behavior tuning rather than database redesign.
- Import/graph relations are currently Python-specific, so initial expansion should target useful symbol extraction first and treat richer language-specific graph relations as later follow-up work.

Recommended rollout order:
1. JavaScript + TypeScript
2. YAML + shell/bash + Dockerfile + CSS
3. Ruby
4. C#
5. C++

Rationale:
- JS/TS is the highest-value next wave for modern mixed-language repos and fits the current symbol-first architecture best.
- Config/ops languages are broadly useful but should use support-depth appropriate to each file type instead of forcing a heavy symbol model everywhere.
- Ruby is feasible but less urgent than JS/TS.
- C# and C++ are materially harder because useful extraction boundaries and symbol ergonomics are more complex.

Support-depth guidance by language family:
- JS/TS: full parser-backed symbol extraction for classes, functions, methods, exports, interfaces, enums, and type aliases.
- YAML: likely lighter structured extraction first (documents, top-level keys/sections, named jobs/services/workflows depending on file shape) rather than pretending every key is a code symbol.
- Shell/bash: lightweight function extraction plus file-level fallback.
- Dockerfile: instruction/block-aware extraction or file-level fallback; lower need for deep symbol modeling.
- CSS: selector/rule extraction is useful, but keep expectations modest compared with code languages.
- Ruby: parser-backed extraction for classes, modules, methods, and constants.
- C#/C++: parser-backed extraction only after earlier waves are stable; likely needs tighter scoping on which declaration kinds are worth surfacing first.

Rough effort estimates:
- JS/TS: medium project slice
- YAML/shell/Dockerfile/CSS together: small-to-medium follow-on slices
- Ruby: medium slice
- C#: medium-to-large slice
- C++: large slice

Likely parser/package direction to evaluate:
- JavaScript / TypeScript: `tree-sitter-javascript`, `tree-sitter-typescript`
- CSS: `tree-sitter-css`
- YAML: `tree-sitter-yaml`
- Bash / shell: `tree-sitter-bash`
- Dockerfile: `tree-sitter-dockerfile` if available/maintained, otherwise lighter non-tree-sitter structured parsing may be more pragmatic
- Ruby: `tree-sitter-ruby`
- C#: `tree-sitter-c-sharp`
- C++: `tree-sitter-cpp`

Execution recommendation:
- Keep TASK-043 ahead of execution on this expansion track because trust/path issues in current hybrid output affect active downstream use immediately.
- Treat TASK-044 as the umbrella for breadth expansion and promote DRAFT-020 first when ready to implement the next language wave.
- After JS/TS lands, reevaluate whether config/ops files need a new retrieval category distinct from the current markdown-vs-code split.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Captured a concrete language-expansion roadmap: parser-per-language architecture assessment, prioritized rollout order, support-depth guidance per language family, rough effort estimates, and likely parser/package candidates. Recommendation is to keep this as a parallel expansion track in backlog, but execute TASK-043 before starting broad language support work. Highest-value next implementation wave is JS/TS, followed by config/ops languages, then Ruby, C#, and C++.
<!-- SECTION:FINAL_SUMMARY:END -->
