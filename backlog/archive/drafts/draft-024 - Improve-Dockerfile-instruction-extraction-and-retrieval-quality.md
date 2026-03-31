---
id: DRAFT-024
title: Improve Dockerfile instruction extraction and retrieval quality
status: Draft
assignee: []
created_date: '2026-03-31 06:21'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Downstream retesting after TASK-043 and TASK-048 confirms that file-path propagation, shell startup indexing, and CSS lookup for real .css files are improved. A remaining gap is concept retrieval over Dockerfile content: queries framed around Dockerfile instructions such as COPY, RUN, FROM, requirements installation, or base-image setup still tend to return unrelated Python results. The empty output from `lookup "Dockerfile"` in one transcript was caused by the consumer reading a `results` array from lookup instead of `selectedResult`, so the real remaining issue is instruction-level Dockerfile retrieval quality rather than standalone Dockerfile surfacing.
<!-- SECTION:DESCRIPTION:END -->
