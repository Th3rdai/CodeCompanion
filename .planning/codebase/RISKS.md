# Risks

**Analysis Date:** 2026-03-14

## Security Risks

| Risk                                   | Severity | Mitigation                                     | Status    |
| -------------------------------------- | -------- | ---------------------------------------------- | --------- |
| GitHub token in config file            | Medium   | Masked in API; document data dir permissions   | Partial   |
| MCP client env vars (tokens) in config | Medium   | Validation; masked in API                      | Partial   |
| Path traversal in file read            | High     | isWithinBasePath, isUnderRoot                  | Addressed |
| Subprocess injection (MCP stdio)       | High     | validateAndNormalizeConfig rejects shell chars | Addressed |

## Operational Risks

| Risk                         | Severity | Mitigation                        | Status    |
| ---------------------------- | -------- | --------------------------------- | --------- |
| Ollama offline               | Low      | 503, friendly UI message          | Addressed |
| Server crash (Electron)      | Low      | Dialog, restart option            | Addressed |
| Port conflict                | Low      | findFreePort, fallback            | Addressed |
| Rate limit bypass (IP spoof) | Low      | X-Forwarded-For used; proxy trust | Accept    |

## Technical Risks

| Risk                                 | Severity | Mitigation                                 | Status  |
| ------------------------------------ | -------- | ------------------------------------------ | ------- |
| LLM output format drift (tool calls) | Medium   | Parse robustness; fallback                 | Partial |
| Stream parse failure                 | Medium   | Buffer handling; error recovery            | Partial |
| History dir growth                   | Low      | No pagination; listConversations reads all | Open    |
| Single-process rate limit            | Low      | Accept for desktop; Redis if scaling       | Accept  |

## Dependency Risks

| Risk                      | Severity | Mitigation                    | Status    |
| ------------------------- | -------- | ----------------------------- | --------- |
| MCP SDK breaking changes  | Medium   | Pin version; monitor releases | Monitor   |
| Electron security updates | Medium   | Keep electron current         | Monitor   |
| React 19 compatibility    | Low      | Already on 19.x               | Addressed |

## Recommendation Summary

1. **High:** Ensure all file read paths use `isWithinBasePath` / `isUnderRoot`
2. **Medium:** Add tests for tool-call parsing and stream handling
3. **Medium:** Document data directory security (token storage)
4. **Low:** Add ESLint + Prettier; consolidate test layout

---

_Risks assessment: 2026-03-14_
