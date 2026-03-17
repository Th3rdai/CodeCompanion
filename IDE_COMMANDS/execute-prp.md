# Execute BASE PRP

Implement a feature using the PRP file.

## PRP File: $ARGUMENTS

## Execution Process

1. **Load PRP**
   - Read the specified PRP file
   - Understand all context and requirements
   - Follow all instructions in the PRP and extend the research if needed
   - Ensure you have all needed context to implement the PRP fully
   - Do more web searches and codebase exploration as needed

2. **ULTRATHINK**
   - Think hard before you execute the plan. Create a comprehensive plan addressing all requirements.
   - Break down complex tasks into smaller, manageable steps using your todos tools.
   - Use the TodoWrite tool to create and track your implementation plan.
   - Identify implementation patterns from existing code to follow.

3. **Execute the plan**
   - Execute the PRP
   - Implement all the code

4. **Validate**
   - Run each validation command
   - Run tests (pytest, npm test, etc.) as appropriate
   - Fix any failures
   - Re-run until all pass

5. **Complete**
   - Ensure all checklist items done
   - Run final validation suite
   - Report completion status
   - Read the PRP again to ensure you have implemented everything

6. **Option to run the project**
   - If the PRP describes a runnable app (e.g. Flask, dev server, CLI): ask "**Run the project now?**" (e.g. `python app.py`, `npm run dev`)
   - If **yes**: start the app (in background if appropriate) and give the user the URL or command to use
   - If **no**: tell them how to run it themselves

7. **Journal entry**
   - Append a journal entry (see ADD-TO-PROJECT § Journal). Format: `HH:MM | execute-prp | PRPs/<path> | Completed`. Use the actual PRP path.

Note: If validation fails or you're stuck, re-read the PRP for validation commands and checklist; fix and retry.