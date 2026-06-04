# PCI-Assistant Database Issue Summary

**Date:** 2026-05-16
**Issue:** Requirement 11.3.1 not found in PCI-Assistant database
**Status:** ✅ **RESOLVED** - Database is complete, issue was client-side model reliability

## Resolution (2026-05-16)

**Root Cause:** The PCI-Assistant database was COMPLETE and working correctly. The "requirement not found" errors were caused by unreliable model behavior during the initial investigation, not a database issue.

**Actual Issue:** Speed optimization experiments with smaller models (qwen2.5:7b, qwen3:latest) revealed tool result presentation reliability issues, which initially masked successful requirement lookups.

**Final Solution:**

- ✅ Database confirmed complete (requirement 11.3.1 exists and works)
- ✅ Applied prompt engineering fix to `lib/chat-post-handler.js:1960-1968` for better tool result presentation
- ✅ Reverted to reliable model configuration (`qwen3.6:latest` 23.9GB) for consistent behavior
- ✅ All PCI-Assistant tools working correctly (`requirement_lookup`, `evidence_analysis`, `pci_compliance_check`, `gap_assessment`)

**Performance:** ~110 seconds per request (acceptable trade-off for reliability). See `docs/PCI-ASSISTANT-SPEED-OPTIMIZATION.md` for full analysis.

## Problem

PCI-Assistant's `requirement_lookup` tool cannot find requirement **11.3.1** ("Internal vulnerability scans performed"), despite this being a valid requirement in PCI-DSS v4.0.1.

### Symptom

```json
{
  "version": "4.0.1",
  "found": false,
  "error": "Requirement 11.3.1 not found",
  "available_sections": [
    "4",
    "9",
    "3",
    "5",
    "12",
    "11",
    "8",
    "10",
    "1",
    "2",
    "6",
    "7"
  ]
}
```

### What's Working

✅ PCI-Assistant MCP connection successful (SSE transport)
✅ Tool calls are fast and reliable (~22ms response time)
✅ Section 11 is listed in available_sections
✅ Code Companion integration working correctly

### What's Broken

❌ Requirement 11.3.1 returns "not found"
❌ Unknown if other x.x.x sub-requirements are also missing

## Configuration

**PCI-Assistant Server:**

- URL: `https://192.168.50.7:8000/mcp/sse`
- API Key: `pci_mcp_GWVYGWb2fSSRAii8NFiYs_IJQjurHsakv304YlKkvjs`
- Transport: SSE
- Version: 4.0.1
- Available tools: `pci_compliance_check`, `evidence_analysis`, `gap_assessment`, `requirement_lookup`

**Code Companion Client:**

- Config file: `/Users/james/Library/Application Support/code-companion/.cc-config.json`
- Client ID: `pci-assistant`
- Auto-connect: `true`
- Status: Connected (4 tools discovered)

## Root Cause Analysis

### Possible Causes

1. **Incomplete Database Seeding**
   - PCI-DSS v4.0.1 requirements may not have been fully imported
   - Sub-requirements (x.x.x format) might not be indexed

2. **Indexing Issue**
   - Parent requirements (11.3) might exist, but not sub-requirements (11.3.1)
   - Database might only contain top-level requirements

3. **Data Format Mismatch**
   - Requirement IDs in database might use different format
   - e.g., "Requirement 11.3.1" vs "11.3.1" vs separate fields

### What We Know About 11.3.1

From PCI-DSS v4.0.1 official document:

**Requirement 11.3.1**

- **Title:** "Internal vulnerability scans are performed"
- **Parent:** 11.3 ("External and internal vulnerabilities are regularly identified, prioritized, and addressed")
- **Type:** Defined Approach Testing Procedures
- **Content:** Detailed testing procedures for internal vulnerability scanning

This is definitely a valid requirement and should exist in any complete v4.0.1 database.

## Investigation Steps Completed

1. ✅ Verified PCI-Assistant MCP connection
2. ✅ Checked Code Companion configuration
3. ✅ Reviewed connection logs (successful, 22ms response)
4. ✅ Confirmed 11.3.1 exists in PCI-DSS v4.0.1
5. ✅ Created test checklist for systematic testing

## Next Steps

### 1. Systematic Testing (see PCI-REQUIREMENT-TEST-CHECKLIST.md)

Test multiple requirements through Code Companion chat to identify pattern:

- Parent requirements (x.x format): 1.1, 3.4, 6.1, 11.3, 12.1
- Sub-requirements (x.x.x format): 1.1.1, 3.4.1, 6.3.1, 8.3.1, 11.3.1, 11.3.2, 12.3.1

### 2. PCI-Assistant Server Investigation

**Check logs:**

```bash
# Docker
docker logs pci-assistant-container

# Systemd service
journalctl -u pci-assistant -f

# Direct log files
tail -f /var/log/pci-assistant/app.log
```

**Check database:**

```sql
-- Total requirements
SELECT COUNT(*) FROM requirements;

-- Section 11 requirements
SELECT requirement_id, title
FROM requirements
WHERE requirement_id LIKE '11%'
ORDER BY requirement_id;

-- All x.x.x format requirements
SELECT requirement_id, title
FROM requirements
WHERE requirement_id REGEXP '^[0-9]+\.[0-9]+\.[0-9]+$'
LIMIT 10;
```

**Verify data import:**

```bash
# Check for PCI-DSS data files
ls -l /app/data/pci-dss-v4.0.1/
cat /app/data/import-status.json

# Re-import if needed
./scripts/import-pci-dss-v4.0.1.sh
```

### 3. Diagnosis Tree

```
Is 11.3 (parent) found?
├─ YES → Sub-requirement indexing issue
│  └─ Check: Are ANY x.x.x requirements indexed?
│     ├─ YES → Incomplete import (11.3.1 specifically missing)
│     └─ NO → Sub-requirements not indexed at all
│
└─ NO → Section 11 data missing entirely
   └─ Check: Are other sections' parent requirements found?
      ├─ YES → Section 11 specific issue
      └─ NO → Database severely incomplete
```

## Resolution Path

Based on systematic test results:

**If NO sub-requirements work:**
→ Database only has parent requirements
→ Need to import sub-requirements from PCI-DSS v4.0.1 document

**If SOME sub-requirements work:**
→ Incomplete database seeding
→ Re-run full PCI-DSS v4.0.1 import

**If only Section 11 fails:**
→ Section-specific data import issue
→ Re-import just Section 11 requirements

## Impact

**Low immediate impact** - PCI-Assistant connection and tool calling works correctly. This is a data completeness issue, not a connectivity or integration problem.

**Users affected:** Anyone using `requirement_lookup` for detailed sub-requirements will get false negatives for missing entries.

**Workaround:** Use parent requirement (11.3) and manually reference official PCI-DSS document for sub-requirement details.

## Files

- `PCI-REQUIREMENT-TEST-CHECKLIST.md` - Systematic testing guide
- `PCI-ASSISTANT-ISSUE-SUMMARY.md` - This document
- Test logs: `/Users/james/Library/Application Support/code-companion/logs/app.log`

## Contact

For PCI-Assistant server issues, contact server administrator at `192.168.50.7:8000`.

For Code Companion MCP client issues, check `lib/mcp-client-manager.js` or `lib/mcp-api-routes.js`.
