# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, Antigravity, etc.) when working with code in this repository.

## MANDATORY RULE: Long-Running Commands

Before running any command that may take longer than 10 seconds, the agent MUST:
1. Warn the user with an estimated duration
2. Explain what will be tracked/visible so they can monitor progress
3. For long-running dev servers, background them and notify the user how to check status

This rule applies to `npx vite`, `npx cap run`, `python build.py`, `npm install`, `npx cap sync`, and any other command that runs >10s.

## MANDATORY RULE: Skill-First Execution

Before implementing ANY task, feature, bug fix, refactor, or UI change, the agent MUST:

1. Determine which skill(s) from `.opencode/skills/<skill-name>/SKILL.md` apply (e.g., `incremental-implementation`, `frontend-ui-engineering`, `debugging-and-error-recovery`, `planning-and-task-breakdown`, etc.)
2. Load the full SKILL.md using the `skill` tool (e.g., `skill({ name: "incremental-implementation" })`)
3. Follow the skill instructions strictly — never implement directly without reading the skill first

This rule applies to every single prompt. The agent may NOT skip this step for any reason, including "this is too small" or "I'll just do it quickly."

## Repository Overview

A collection of skills for Claude.ai and Claude Code for senior software engineers. Skills are packaged instructions and scripts that extend Claude and your coding agents capabilities.

## OpenCode Integration

OpenCode uses a **skill-driven execution model** powered by the `skill` tool and this repository's `.opencode/skills/` directory.

## SKILL DISCOVERY & INVOCATION (CRITICAL)

OpenCode auto-discovers all skills from `.opencode/skills/` at startup and lists them in the `<available_skills>` system prompt.

To invoke a skill, use the native `skill` tool:
```
skill({ name: "<skill-name>" })
```

This will inject the full SKILL.md instructions into context.

Core Rules
If a task matches a skill, you MUST invoke it
Skills are located in `.opencode/skills/<skill-name>/SKILL.md`
Never implement directly if a skill applies
Always follow the skill instructions exactly (do not partially apply them)
Intent → Skill Mapping
The agent should automatically map user intent to skills:

Feature / new functionality → spec-driven-development, then incremental-implementation, test-driven-development
Planning / breakdown → planning-and-task-breakdown
Bug / failure / unexpected behavior → debugging-and-error-recovery
Code review → code-review-and-quality
Refactoring / simplification → code-simplification
API or interface design → api-and-interface-design
UI work → frontend-ui-engineering
Lifecycle Mapping (Implicit Commands)
OpenCode does not support slash commands like /spec or /plan.

Instead, the agent must internally follow this lifecycle:

DEFINE → spec-driven-development
PLAN → planning-and-task-breakdown
BUILD → incremental-implementation + test-driven-development
VERIFY → debugging-and-error-recovery
REVIEW → code-review-and-quality
SHIP → shipping-and-launch
Execution Model
For every request:

Determine if any skill applies (even 1% chance)
Invoke the appropriate skill using the skill tool
Follow the skill workflow strictly
Only proceed to implementation after required steps (spec, plan, etc.) are complete
Anti-Rationalization
The following thoughts are incorrect and must be ignored:

"This is too small for a skill"
"I can just quickly implement this"
"I’ll gather context first"
Correct behavior:

Always check for and use skills first
This ensures OpenCode behaves similarly to Claude Code with full workflow enforcement.

### Core Rules

- If a task matches a skill, you MUST invoke it
- Skills are located in `.opencode/skills/<skill-name>/SKILL.md`
- Never implement directly if a skill applies
- Always follow the skill instructions exactly (do not partially apply them)

### Intent → Skill Mapping

The agent should automatically map user intent to skills:

- Feature / new functionality → `spec-driven-development`, then `incremental-implementation`, `test-driven-development`
- Planning / breakdown → `planning-and-task-breakdown`
- Bug / failure / unexpected behavior → `debugging-and-error-recovery`
- Code review → `code-review-and-quality`
- Refactoring / simplification → `code-simplification`
- API or interface design → `api-and-interface-design`
- UI work → `frontend-ui-engineering`

### Lifecycle Mapping (Implicit Commands)

OpenCode does not support slash commands like `/spec` or `/plan`.

Instead, the agent must internally follow this lifecycle:

- DEFINE → `spec-driven-development`
- PLAN → `planning-and-task-breakdown`
- BUILD → `incremental-implementation` + `test-driven-development`
- VERIFY → `debugging-and-error-recovery`
- REVIEW → `code-review-and-quality`
- SHIP → `shipping-and-launch`

### Execution Model

For every request:

1. Determine if any skill applies (even 1% chance)
2. Invoke the appropriate skill using the `skill` tool
3. Follow the skill workflow strictly
4. Only proceed to implementation after required steps (spec, plan, etc.) are complete

### Anti-Rationalization

The following thoughts are incorrect and must be ignored:

- "This is too small for a skill"
- "I can just quickly implement this"
- "I’ll gather context first"

Correct behavior:

- Always check for and use skills first

This ensures OpenCode behaves similarly to Claude Code with full workflow enforcement.

## Orchestration: Personas, Skills, and Commands

This repo has three composable layers. They have different jobs and should not be confused:

- **Skills** (`.opencode/skills/<name>/SKILL.md`) — workflows with steps and exit criteria. The *how*. Mandatory hops when an intent matches.
- **Personas** (`agents/<role>.md`) — roles with a perspective and an output format. The *who*.
- **Slash commands** (`.claude/commands/*.md`) — user-facing entry points. The *when*. The orchestration layer.

Composition rule: **the user (or a slash command) is the orchestrator. Personas do not invoke other personas.** A persona may invoke skills.

The only multi-persona orchestration pattern this repo endorses is **parallel fan-out with a merge step** — used by `/ship` to run `code-reviewer`, `security-auditor`, and `test-engineer` concurrently and synthesize their reports. Do not build a "router" persona that decides which other persona to call; that's the job of slash commands and intent mapping.

See [agents/README.md](agents/README.md) for the decision matrix and [references/orchestration-patterns.md](references/orchestration-patterns.md) for the full pattern catalog.

**Claude Code interop:** the personas in `agents/` work as Claude Code subagents (auto-discovered from this plugin's `agents/` directory) and as Agent Teams teammates (referenced by name when spawning). Two platform constraints align with our rules: subagents cannot spawn other subagents, and teams cannot nest. Plugin agents silently ignore the `hooks`, `mcpServers`, and `permissionMode` frontmatter fields.

## Creating a New Skill

### Directory Structure

```
.opencode/skills/
  {skill-name}/           # kebab-case directory name
    SKILL.md              # Required: skill definition
    scripts/              # Required: executable scripts
      {script-name}.sh    # Bash scripts (preferred)
  {skill-name}.zip        # Required: packaged for distribution
```

### Naming Conventions

- **Skill directory**: `kebab-case` (e.g. `web-quality`)
- **SKILL.md**: Always uppercase, always this exact filename
- **Scripts**: `kebab-case.sh` (e.g., `deploy.sh`, `fetch-logs.sh`)
- **Zip file**: Must match directory name exactly: `{skill-name}.zip`

### SKILL.md Format

```markdown
---
name: {skill-name}
description: {One sentence describing what the skill does, followed by one or more "Use when" trigger conditions. Include trigger phrases like "Deploy my app" or "Check logs" when helpful.}
---

# {Skill Title}

{Brief overview of what the skill does and why it matters.}

## How It Works

{Numbered list explaining the skill's workflow}

Equivalent headings like `Workflow`, `Core Process`, or `When to Use` are fine when they communicate the same structure clearly.

## Usage (Optional)

Include this section only if the skill ships runnable helpers under `scripts/`. Markdown-only skills can omit both the section and the directory entirely.

```bash
bash /mnt/.opencode/skills/user/{skill-name}/scripts/{script}.sh [args]
```

**Arguments:**
- `arg1` - Description (defaults to X)

**Examples:**
{Show 2-3 common usage patterns}

## Output

{Show example output users will see}

## Present Results to User

{Template for how Claude should format results when presenting to users}

## Troubleshooting

{Common issues and solutions, especially network/permissions errors}
```

### Best Practices for Context Efficiency

Skills are loaded on-demand — only the skill name and description are loaded at startup. The full `SKILL.md` loads into context only when the agent decides the skill is relevant. To minimize context usage:

- **Keep SKILL.md under 500 lines** — put detailed reference material in separate files
- **Write specific descriptions** — helps the agent know exactly when to activate the skill
- **Use progressive disclosure** — reference supporting files that get read only when needed
- **Prefer scripts over inline code** — script execution doesn't consume context (only output does)
- **File references work one level deep** — link directly from SKILL.md to supporting files

### Script Requirements

- Use `#!/bin/bash` shebang
- Use `set -e` for fail-fast behavior
- Write status messages to stderr: `echo "Message" >&2`
- Write machine-readable output (JSON) to stdout
- Include a cleanup trap for temp files
- Reference the script path as `/mnt/.opencode/skills/user/{skill-name}/scripts/{script}.sh`

### Creating the Zip Package

After creating or updating a skill:

```bash
cd .opencode/skills
zip -r {skill-name}.zip {skill-name}/
```

### End-User Installation

Document these two installation methods for users:

**Claude Code:**
```bash
cp -r .opencode/skills/{skill-name} ~/.opencode/skills/
```

**claude.ai:**
Add the skill to project knowledge or paste SKILL.md contents into the conversation.

If the skill requires network access, instruct users to add required domains at `claude.ai/settings/capabilities`.

## Platform: Windows + Git Bash

This repo uses **Git Bash** (included with Git for Windows) to run `.sh` scripts. PowerShell is NOT used for `.sh` scripts.

### IMPORTANT: Do NOT auto-refactor .sh scripts

- `.sh` scripts in `scripts/` (`start-tunnel.sh`, etc.) are designed for **Git Bash on Windows** AND Linux/macOS
- **Do NOT rewrite them to PowerShell** — Git Bash is the standard shell for this project
- The primary tunnel/ngrok script is `scripts/start-tunnel.sh` — run it via Git Bash:
  ```bash
  bash scripts/start-tunnel.sh          # start Laravel + ngrok, update .env
  bash scripts/start-tunnel.sh --rebuild # same + rebuild Capacitor APK
  ```
- The script auto-updates both `VITE_API_BASE_URL` (frontend `.env`) and `NGROK_URL` (backend `.env`) with the live ngrok URL
- After running the script, rebuild the Capacitor app: `npm run build:mobile` or `py build.py --install`
- Only create `.ps1` equivalents if the user explicitly asks

### VITE_API_BASE_URL build-time caveat

`VITE_API_BASE_URL` is embedded into the JS bundle at **build time**. Changing `.env` alone does NOT update a running app. After updating `.env`, always rebuild:
```bash
npm run build:mobile    # py build.py --build-only
npx cap copy && npx cap run android
```

## Lessons Learned

### 1. Always close `<style>` tags when injecting HTML programmatically
- **Mistake**: `content.replace("</head>", f"<style>{CSS}\n{SCRIPT}\n</head>")` — missing `</style>` before `</head>`.
- **Why it breaks**: HTML5 parser enters RAWTEXT state on `<style>` and treats everything until `</style>` as CSS text. Without `</style>`, it swallows `<script>`, `</head>`, `<body>`, and all body content — entire page becomes unusable, no JS executes, body is empty.
- **Fix**: Always pair `<style>` with `</style>`: `f"<style>{CSS}\n</style>\n{SCRIPT}\n</head>"`.
- **Detection**: CDP shows `document.body.innerHTML = ""`, `document.scripts.length = 0`, `document.head.querySelectorAll("script").length = 0` even though HTML source has scripts.

### 2. Self-removing inline scripts (`document.currentScript.remove()`) break React hydration
- **Mistake**: Assuming TanStack Start's SSR inline scripts (scroll restoration, stream barrier) can safely `document.currentScript.remove()` themselves without affecting hydration.
- **Why it breaks**: These scripts execute synchronously during HTML parsing and remove themselves from the DOM before React's `hydrateRoot` walks the tree. React expects to find `<script>` nodes at those positions but finds comment nodes shifted into their place, throwing Error #418.
- **Fix**: Strip `document.currentScript.remove()` calls from built HTML via `re.sub(r';?\s*document\.currentScript\.remove\(\)', '', content)` in the build script. The script nodes remain in DOM (inert, already executed) and React hydrates cleanly.
- **Detection**: React Error #418 with args `["HTML"]` — "server rendered HTML didn't match the client". Body renders fine (React recovers via client rendering) but console shows minified error.

### 3. Verify post-patch DOM against React's hydration tree
- When patching SSR output (injecting elements, stripping JS), always verify the actual browser DOM structure matches what React's fiber tree expects.
- Use CDP (`Runtime.evaluate` + `DOM.getDocument`) to inspect the live DOM after page load.
- Compare body child nodes in order: React walks first-child → next-sibling, so position matters. Missing/extra/shifted nodes at any position cascade into mismatches for all subsequent siblings.
