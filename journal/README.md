# Validation Journal

| Date | Result | Notes |
|------|--------|-------|
| 2026-03-28 | Pass | Latest **19:08** **`/validate-project`** — P1–P7 green; HTTPS `:4173`; Playwright `BASE_URL=https://127.0.0.1:4173`; P6 save under repo `folder`; P7 `curl -sk`; MCP 11. **16:25** — 134 unit; PW 47 / 2 flaky; P6 `/tmp` 403; P7 `qwen3:8b`. **22:00** docs/tasks. **`journal/2026-03-28.md`** |
| 2026-03-27 | Pass | Latest **20:03** **`/validate-project --thorough`** — P1–P7 green; P6 `folder=` for read/save; P7 `llava:7b` + `qwen2.5:32b`; 1 flaky report-card. **17:46** — `FORCE_HTTP=1` + `PW_REUSE_SERVER=1`; P6 history buffer + file save under repo; P7 `qwen3:latest`; **`journal/2026-03-27.md`** |
| 2026-03-24 | Pass | **`build-file-ops.test.js`** + **install docs** + **CHANGELOG 1.5.3**; **`git push`** **origin** + **th3rdai** **`master`**. **`journal/2026-03-24.md`** |
| 2026-03-23 | Pass | Latest **20:22** — second full validate same day; P1–P7 green; 134 unit; 32 UI / 17 E2E / full PW 48 pass / 15 skip / 1 flaky report-card; P6/P7 HTTP; **`journal/2026-03-23.md`** |
| 2026-03-22 | Pass | Latest **21:34** — full validate resume: P6 file save under repo `folder` (not `/tmp`); P7 `minimax-m2:cloud`; 134 unit; Playwright 47 pass / 15 skip / 2 flaky; also **16:27** run — **journal/2026-03-22.md** |
| 2026-03-21 | Pass | validate-project --thorough: P1–P7 green; test fixes (Jargon glossary dialog scope; Review `getByPlaceholder('Paste your code here...')`; mode tab `Review`/`Security` exact). See journal/2026-03-21.md |
| 2026-03-20 | Pass | P1–P7 green with `FORCE_HTTP=1` + `BASE_URL=http://127.0.0.1:4173` for P4/P5 (avoid HTTPS/default baseURL mismatch). 32 UI + 14 E2E passed, 15 UI skipped. See journal/2026-03-20.md |
| 2026-03-14 | Pass | 27 Playwright + 16 unit tests, all API endpoints, SSE streaming, MCP 11 tools. Full green. |
| 2026-03-17 | Pass | P1–P7 all OK. FORCE_HTTP=1 PORT=4173. icm-scaffolder template copy tests; P4: 32 UI passed; P5: 4 E2E; P6 API + file save/backup; 12 mode prompts, MCP 11. |
