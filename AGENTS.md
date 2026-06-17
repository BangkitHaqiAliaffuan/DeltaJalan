# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, Antigravity, etc.) when working with code in this repository.

## MANDATORY RULE: No Automatic Mobile Builds

The agent MUST NEVER run `npm run build:mobile`, `npx cap`, `python build.py`, `gradlew`, `gradlew.bat`, or any Android/iOS build commands directly — even if the user says "implement your fix perfectly" or "eksekusi plan anda". This includes `npx cap copy`, `npx cap sync`, `gradlew.bat assembleDebug`, and any APK/asset deployment step.

All mobile builds, including `npx cap add android`, `npx cap sync`, `npx cap copy`, `npx cap run`, Gradle builds, and APK installation, are handled EXCLUSIVELY by the user via `bash scripts/start-android.sh`.

If a build step is needed after code changes, inform the user with the exact command to run:
```
bash scripts/start-android.sh --rebuild
```
Do NOT attempt to run any part of the build pipeline yourself.

## MANDATORY RULE: No Automatic Git Commits or Pushes

The agent MUST NOT commit or push any changes unless the user explicitly says "commit", "push", or "commit dan push". This includes both individual file commits and bulk commits. The agent may stage files in preparation, but the commit and push actions themselves require a direct user command.

## MANDATORY RULE: Long-Running Commands

Before running any command that may take longer than 10 seconds, the agent MUST:
1. Warn the user with an estimated duration
2. Explain what will be tracked/visible so they can monitor progress
3. For long-running dev servers, background them and notify the user how to check status

This rule applies to `npx vite`, `npx cap run`, `python build.py`, `npm install`, `npx cap sync`, and any other command that runs >10s.

## MANDATORY RULE: Always Use Context7

Before writing ANY code that involves libraries, frameworks, APIs, SDKs, CLI tools, or cloud services, the agent MUST:

1. Use the Context7 MCP tool (`resolve-library-id` + `query-docs`) to fetch current official documentation
2. This applies even to well-known libraries like React, Next.js, TanStack Router, Tailwind, Laravel, etc.
3. Use version-specific library IDs when the user mentions a version
4. Cite sources in code comments with full URLs

This rule exists because training data goes stale — APIs change, best practices evolve, and patterns that look correct may be outdated against current versions.

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

### 4. Registering custom plugins in MainActivity.java

**Mistake**: Assuming `npx cap sync` alone is enough for a custom Capacitor plugin to work at runtime on Android. The custom plugin `@jalankita/capacitor-exif-gps` was synced correctly into Gradle config (`implementation project(':jalankita-capacitor-exif-gps')`), but Capacitor's runtime annotation scanning (`@CapacitorPlugin`) failed to discover it — possibly because it's a `file:` dependency, not from npm registry.

**Why it breaks**: On Android, Capacitor discovers plugins via annotation scanning at app startup. For local/workspace plugins that aren't installed via `npm install <name>` but via `"file:./path"`, the annotation processor may not register the plugin in the generated plugin list. The JavaScript proxy (`registerPlugin("PhotoExifGps")`) returns a thenable that calls `.then()` from the async function return — which throws "not implemented" because the native side never heard of this plugin.

**Fix**: Always explicitly register custom local plugins in `MainActivity.java`:
```java
import com.jalankita.capacitor.exifgps.PhotoExifGpsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PhotoExifGpsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```
Also import the pre-configured plugin from the package (`import { PhotoExifGps } from "@jalankita/capacitor-exif-gps"`) rather than calling `registerPlugin()` manually in the hook — this avoids returning a thenable from an async function.

**Detection**: Error `"PluginName.then()" is not implemented on android` in WebView console.
**Prevention**: Always check `MainActivity.java` when adding or updating custom Capacitor plugins installed via `file:` path.

### 5. `typeof window.Capacitor !== 'undefined'` is NOT sufficient to detect native platform
- **Mistake**: Using `typeof window.Capacitor !== 'undefined'` alone to check if running in Capacitor native environment.
- **Why it breaks**: `@capacitor/core` sets `window.Capacitor` as a module-load side effect in ALL environments — including plain browsers. The check returns `true` even in dev server (localhost:5173), causing `setupNativeFetch()` to overwrite `window.fetch` with a Capacitor-aware wrapper that calls `CapacitorHttp.request()`. In browser, `CapacitorHttp.request()` hangs indefinitely (no native bridge), freezing the app with `loading = true` forever.
- **Symptoms**: Clicking "Masuk" shows spinner but no network request appears in DevTools, no error thrown, button stays disabled, browser tab appears frozen. Works fine in Android APK because Capacitor bridge is real.
- **Fix**: Always chain `window.Capacitor.isNativePlatform?.() === true`:
  ```typescript
  const isNative =
    typeof window !== 'undefined' &&
    typeof window.Capacitor !== 'undefined' &&
    window.Capacitor.isNativePlatform?.() === true;
  ```
- **Detection**: `window.fetch.toString().includes('native')` returns `false` in Console when it should return `true` in browser. Or check `window.Capacitor.getPlatform()` — if it returns `"web"`, you're not native.
- **Files that had this bug**: `src/lib/api.ts:3`, `src/hooks/useBlobImage.ts:4`, `src/lib/aiStore.ts:156`, `src/routes/admin/export.tsx:51`, `src/hooks/useLocationFromPhoto.ts:24`.
- **Prevention**: When adding ANY new code that checks for Capacitor native, always use `Capacitor.isNativePlatform()` (from dynamic import) or `window.Capacitor.isNativePlatform?.() === true` (from global). Never rely on `typeof window.Capacitor` alone. `@capacitor/core` injects the global in all contexts, including Vite dev server.

### 6. Native batch gallery: `readExifGps` fallback required when plugin returns null GPS
- **Mistake**: Assuming `PhotoExifGps.pickPhotos()` plugin successfully reads GPS from all URIs. The Android plugin returns `lat: null, lng: null` for `ACTION_OPEN_DOCUMENT` batch URIs (DocumentsProvider URIs) on Android 14+ because the ContentProvider strips EXIF GPS by default.
- **Why it breaks**: The single gallery upload works because of a fallback at `upload.tsx:1172-1173` (`if (r.lat == null) await handleGallerySelect(r.file)`) which calls `readExifGps(file)` on the JavaScript side using `exifr`. But the native batch path (`handleNativeBatchSelect`) had no such fallback — it directly used the plugin's null return value.
- **Fix**: In `upload.tsx:1246-1251` (`handleNativeBatchSelect`), add `readExifGps(r.file)` as fallback when `r.lat` is null, matching the web batch path (`handleFilesSelected`) which already does this at line 444-446:
  ```typescript
  const [dateResult, gpsResult] = await Promise.all([
    validatePhotoDate(r.file),
    (r.lat != null && r.lng != null)
      ? Promise.resolve({ latitude: r.lat, longitude: r.lng } as ExifGps)
      : readExifGps(r.file),
  ]);
  ```
- **Detection**: ADB log shows `lat=null lng=null` for all URIs, but single upload shows GPS in UI. ADB log uses plugin's return; UI GPS comes from the JS `exifr.gps()` fallback.
- **Prevention**: When adding any native plugin path that returns per-file data and has a parallel web path, check if the web path has a `readExifGps` fallback and mirror it in the native path.

### 7. `ACCESS_MEDIA_LOCATION` auto-grant masks `READ_MEDIA_IMAGES` not being requested
- **Mistake**: In Capacitor plugin permission checks, only checking `getPermissionState("accessMediaLocation") == GRANTED` before deciding whether to request permissions.
- **Why it breaks**: `ACCESS_MEDIA_LOCATION` is a **normal** permission on Android — auto-granted at install time without user dialog. So `getPermissionState("accessMediaLocation")` returns `GRANTED` immediately, and the code skips requesting permissions entirely. `READ_MEDIA_IMAGES` (a **dangerous** permission that shows a dialog) is **never requested**. When converting DocumentsProvider URI → MediaStore URI + `setRequireOriginal()`, the app "has no access" to the MediaStore URI because `READ_MEDIA_IMAGES` was never granted.
- **Fix**: Always check BOTH permission aliases before proceeding:
  ```java
  if (getPermissionState("accessMediaLocation") == PermissionState.GRANTED
      && getPermissionState("readMediaImages") == PermissionState.GRANTED) {
    doPickPhotos(call);
  } else {
    requestPermissionForAliases(
        new String[] { "accessMediaLocation", "readMediaImages" },
        call, "permissionCallback");
  }
  ```
- **Detection**: Log shows `SecurityException: has no access to content://media/external/images/media/...?requireOriginal=1` for converted MediaStore URIs, even though `ACCESS_MEDIA_LOCATION` is in manifest.
- **Prevention**: When mixing normal permissions (auto-granted) with dangerous permissions (dialog-granted) in the same permission group, always check ALL permission aliases in the gate condition.

### 8. `pickPhotosResult` `getData()` vs `getClipData()` must not be mutually exclusive
- **Mistake**: Using `if-else` structure when processing `data.getData()` and `data.getClipData()`:
  ```java
  if (singleUri != null) {
    photos.put(extractGps(singleUri));
  } else {
    ClipData clipData = data.getClipData();
    // ...
  }
  ```
- **Why it breaks**: On many Android versions, `data.getData()` returns the first URI AND `data.getClipData()` contains ALL URIs (including the first). The `if-else` only processes the first URI and silently drops the rest.
- **Fix**: Process BOTH independently, with dedup:
  ```java
  if (singleUri != null) {
    photos.put(extractGps(singleUri));
  }
  if (clipData != null) {
    for (Uri uri : clipDataUris) {
      if (uri.equals(singleUri)) continue;
      photos.put(extractGps(uri));
    }
  }
  ```
- **Detection**: In batch mode, log shows URIs all fail but count is 3 (from ClipData). Single mode URIs were processed via `getData()`.
- **Prevention**: Always process `getData()` AND `getClipData()` independently when `EXTRA_ALLOW_MULTIPLE=true`.

### 9. Leaflet `fitBounds` zoom animation race condition on unmount
- **Mistake**: Using `map.fitBounds()` without disabling animation when the map might unmount or re-render during the CSS transition.
- **Why it breaks**: `fitBounds` starts a CSS zoom animation. If the component unmounts or re-renders during the animation (e.g., due to state updates from `snapToRoadBatch` resolution or parallel batch processing), `map.remove()` detaches the DOM element while the CSS transition is still queued. The `transitionend` event fires on the detached element, Leaflet tries to read `element._leaflet_pos` which is undefined, throwing `TypeError: Cannot read properties of undefined (reading '_leaflet_pos')`.
- **Fix**: Disable animation on `fitBounds` for preview maps:
  ```typescript
  map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 16, animate: false });
  ```
- **Detection**: Crash in `_onZoomTransitionEnd` → `_getMapPanePos` → `getPosition` when batch state updates trigger re-render of map component.
- **Prevention**: For any Leaflet map that is conditionally rendered or re-renders based on async state updates, pass `animate: false` to `fitBounds`/`setView`/`flyTo` to prevent transitionend races on DOM removal.

## MANDATORY RULE: Use Context Mode

This project has **Context Mode** installed as an MCP server for context optimization.

**What it does:**
- Sandboxes tool output so raw data never enters the context window (98% reduction)
- Provides session continuity across context compaction via SQLite FTS5

**Available tools:**
- `ctx_execute` — Run code in 11 languages (only stdout enters context)
- `ctx_batch_execute` — Multiple commands in one call
- `ctx_execute_file` — Process files in sandbox
- `ctx_index` — Chunk markdown into FTS5 with BM25 ranking
- `ctx_search` — Query indexed content on-demand
- `ctx_fetch_and_index` — Fetch URLs, convert to markdown, index with 24h TTL cache

**Usage:** Prefer `ctx_execute` over `Bash` when the command output is large (logs, test output, API responses). The raw output stays in the sandbox and only a compact summary enters context.
