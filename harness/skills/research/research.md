---
name: research
description: "Gather context from the codebase and web. Use when researching a topic, finding code examples, or gathering information before planning."
---

# Skill: Research

## Purpose

Gather context from the codebase and the web to inform planning and building decisions.

## When to Apply

- User asks to research a topic or technology
- Before creating a plan (research → plan → build flow)
- User wants code examples from the web
- User wants to understand how something works

## Inputs

- Research query or topic
- Optional: scope (codebase-only, web-only, both)
- Optional: max results

## Outputs

- Summary of findings
- Relevant code snippets (from codebase or web)
- Links to relevant resources
- Key takeaways for planning

## Procedure

1. **Receive query** — Accept the research topic or question
2. **Determine scope** — Codebase search, web search, or both
3. **Search codebase** — Use `builtin.search_files` and `builtin.read_file`
4. **Search web** — Use `crawl4ai-rag.search_web` for web results
5. **Extract content** — Use `crawl4ai-rag.extract_content` for specific URLs
6. **Synthesize** — Combine findings into a coherent summary
7. **Cite sources** — Include file:line for codebase, URLs for web

## Tool Binding

- `builtin.search_files` — Codebase content search
- `builtin.read_file` — Read specific files
- `crawl4ai-rag.search_web` — Web search
- `crawl4ai-rag.extract_content` — Extract content from URLs
- `crawl4ai-rag.crawl_website` — Crawl a full website
- `google-ai-studio.generate_content` — AI synthesis of findings
