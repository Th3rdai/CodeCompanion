---
name: review
description: "AI code review with structured report cards and letter grades. Use when reviewing code quality, architecture, and best practices."
---

# Skill: Code Review

## Purpose

Perform structured AI code reviews with letter grades (A–F) across multiple dimensions: code quality, architecture, security, performance, maintainability, and documentation.

## When to Apply

- User submits code for review (Review mode)
- User asks for a code quality assessment
- User wants a 'report card' on their code
- Multi-file review of a folder or project

## Inputs

- Source code (inline or file path or folder path)
- Optional: specific focus areas (security, performance, etc.)
- Optional: model override (defaults to 'auto')

## Outputs

- Structured report card with letter grades per dimension
- Overall grade and summary
- Specific findings with file:line references
- Actionable recommendations

## Procedure

1. **Receive code** — Accept inline code, a file path, or a folder path
2. **Determine scope** — Single file vs multi-file vs folder scan
3. **Select model** — Use 'auto' for automatic model selection, or a specific Ollama model
4. **Run review** — Call `builtin.review_run` with model + code/sourcePath
5. **Format output** — Present the report card in a readable format
6. **Highlight criticals** — Surface any F-grade items at the top

## Tool Binding

- `builtin.review_run` — The core review pipeline
- `builtin.read_file` — For reading source files
- `builtin.search_files` — For finding patterns across files

## Evaluation Criteria

- Grades are deterministic for the same input + model
- F-grade items must include file:line references
- Summary must include an overall letter grade
- Recommendations must be actionable (not vague)
