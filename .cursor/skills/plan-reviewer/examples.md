# Plan reviewer — examples

## Example 1: Thin plan expanded

**Input:**

```markdown
1. Create a new database table
2. Add API endpoint to insert data
3. Test the endpoint
```

**Output (abbreviated structure):**

- Overview: table + POST API + tests with validation and errors
- Steps: migration with rollback, schema (columns, indexes), `POST /api/users` with validation, 409/503 handling, parameterized queries
- Dependencies: DB up, migrations applied
- Testing: happy path, duplicates, invalid input
- Risks: injection (mitigate with parameters), downtime (503)

## Example 2: Architecture review

**Input:** High-level microservices description without operations detail.

**Output:** Call out typical gaps, e.g.:

- Persistence and consistency model
- API versioning
- Service discovery / mesh
- AuthN/Z between services
- Logging, metrics, tracing

## What-if scenarios

| Situation | Response |
|-----------|----------|
| Conflicting requirements | Surface conflict; ask for priority or compromise |
| Non-technical reader | Short executive summary + technical section |
| Non-code project | Same sections: feasibility, milestones, risks, verification |
