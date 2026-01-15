# CLAUDE AGENT DIRECTIVES

**PRIMARY OBJECTIVE**: Function as an expert software engineer to complete tasks in this codebase. Adhere to all protocols and standards defined in this document.

---

## PROJECT OVERVIEW

This is a personal website for saneel.xyz featuring a CLI-like terminal interface. Users interact with the site through commands (`/help`, `/work`, `/content`, `/fun`, `/clear`, `/about`).

**Tech Stack**: Vanilla HTML5, CSS3, JavaScript (no build tools or dependencies)

**Key Files**:
- `index.html` - Main HTML structure with terminal UI
- `cli.js` - Command handling and output rendering logic
- `style-cli.css` - Terminal styling and animations

---

## CORE DIRECTIVES

1.  **Context is critical**: Before any action, analyze all provided context, including task descriptions, file contents, and this document.
2.  **Plan before coding**: For complex tasks, formulate a step-by-step plan. Use comments or a temporary file to outline your approach.
3.  **Iterate on solutions**: Generate code, test it, and refine it based on the results. Do not assume the first solution is optimal.
4.  **Verify all outputs**: Review your generated code, commands, and text for correctness, style, and adherence to project standards before finalizing.

---

## MULTI-AGENT COORDINATION PROTOCOL

**IMPORTANT**: This protocol is mandatory when multiple agents are active. To check for other agents, read the `.agent-context.md` file.

### Single-Agent Mode

-   If `.agent-context.md` does not exist or the `Active Agents` table is empty, you are in **Single-Agent Mode**.
-   **ACTION**: Ignore the coordination protocol. Proceed directly with the task.

### Multi-Agent Mode

-   If other agents are listed in `.agent-context.md`, you are in **Multi-Agent Mode**.
-   **ACTION**: You MUST follow this protocol.

#### The Shared Context File: `.agent-context.md` on the `agent-coordination` branch

This file is the single source of truth for all agent activity. It lives on a dedicated, orphan branch named `agent-coordination` and MUST be synchronized using the specific git commands below. Your feature branch should not contain this file.

**Context File Structure:**

```markdown
# Agent Context - Last Updated: [TIMESTAMP]

## Active Agents
| Agent ID | Status  | Current Task                | Started | Last Update |
|----------|---------|-----------------------------|---------|-------------|
| agent-1  | WORKING | Implementing login system   | 14:23   | 14:45       |

## File Locks
| File/Directory | Locked By | Reason                      | Since |
|----------------|-----------|-----------------------------|-------|
| src/auth/*     | agent-1   | Refactoring authentication  | 14:23 |

## Completed Work
- [14:50] agent-2: Completed REST API routes in src/api/

## Pending Integrations
- agent-1 (auth) needs to integrate with agent-2 (api) after auth completion
```

**Protocol Steps:**

### Branch Initialization (First Agent Only)

The first agent to start on a project is responsible for creating the `agent-coordination` branch. Subsequent agents will use the existing branch.

**ACTION**: Before syncing context, check if the branch exists by running `git ls-remote --heads origin agent-coordination`.

-   **If the command returns output**: The branch exists. Proceed to the standard protocol below.
-   **If the command returns empty**: You are the first agent. You MUST create the branch:
    1.  Create an initial `.agent-context.md` file with empty tables.
    2.  Run `git checkout --orphan temp-coordination`.
    3.  Run `git add .agent-context.md`.
    4.  Run `git commit -m "feat: initialize agent coordination branch"`.
    5.  Run `git push origin temp-coordination:agent-coordination`.
    6.  Run `git checkout -` to return to your original branch.
    7.  Run `git branch -D temp-coordination` to clean up the temporary local branch.

After initialization, follow the standard protocol.

### Standard Protocol

1.  **On Task Start**:
    -   **Sync Context**: Run `git fetch origin agent-coordination && git checkout agent-coordination -- .agent-context.md` to get the latest context.
    -   **Read and Verify**: Read the file to check for conflicts.
    -   **Update Locally**: Modify the file to add your agent to `Active Agents` and lock necessary files.
    -   **Commit Context**: Run `git add .agent-context.md && git commit -m "agent-X: Starting task" && git push origin HEAD:agent-coordination`.

2.  **During Task Execution**:
    -   **Update Locally**: Modify `.agent-context.md` with your progress (e.g., update timestamp, release locks).
    -   **Commit Context**: Periodically run `git add .agent-context.md && git commit -m "agent-X: Progress update" && git push origin HEAD:agent-coordination`.
    -   **Handle Conflicts**: If the push fails, you MUST immediately run the sync command again, re-apply your changes to the new context file, and then try to commit again.

3.  **On Task Completion**:
    -   **Update Locally**: Modify `.agent-context.md` to move your agent to `Completed Work` and release all locks.
    -   **Commit Final Context**: Run `git add .agent-context.md && git commit -m "agent-X: Task complete" && git push origin HEAD:agent-coordination`.

---

## PROMPT ENGINEERING DIRECTIVES

-   **Specificity is key**: Your prompts to yourself or other models must be precise. For bug fixes, describe the exact replication steps, expected behavior, and actual behavior.
-   **Use structured formats**: Use XML tags (`<instructions>`, `<example>`, `<code>`) to structure prompts and delineate context, instructions, and examples.
-   **Provide few-shot examples**: When asking for a specific format or style, provide one or more examples of the desired output.
-   **Deconstruct complex tasks**: Break down large tasks into a sequence of smaller, well-defined steps.

---

## CODE QUALITY MANDATES

These are non-negotiable standards for this project.

-   **Testing**: Test commands manually in browser. Verify all `/` commands work correctly.
-   **Style Enforcement**: Maintain consistent code formatting. Use 4-space indentation.
-   **Naming Conventions**: Use `camelCase` for JavaScript variables and functions.
-   **Documentation**: Add comments for complex logic. Use `// TODO:` for future work and `// FIXME:` for known issues.
-   **Browser Compatibility**: Ensure changes work across modern browsers (Chrome, Firefox, Safari, Edge).

---

## OPERATIONAL BOUNDARIES

### Authorized Actions

-   Implement features, refactor code, fix bugs, and write tests according to the project standards.
-   Make reasonable implementation decisions that align with the existing architecture.
-   Add new CLI commands following the existing pattern in `cli.js`.
-   Update styling to maintain the terminal aesthetic.

### Actions Requiring Human Review

**You MUST stop and ask for human review before proceeding with any of the following:**

-   **Major Architectural Changes**: Any significant deviation from the vanilla JS approach.
-   **Adding New Dependencies**: Introducing any new third-party libraries or frameworks.
-   **Ambiguous Requirements**: If a task is unclear, present the ambiguity, your proposed interpretations, and ask for a decision.
-   **Personal Information Changes**: Any modifications to the content displayed about Saneel.

### Clarification Protocol

When asking for clarification, you must:

1.  State the ambiguity clearly.
2.  List the possible interpretations and your recommended approach.
3.  Explain the potential impact of the decision.
