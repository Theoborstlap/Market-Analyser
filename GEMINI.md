# Antigravity Token Efficiency & Context Rules (STRICT)

## 1. Codebase Discovery via Graphify (MANDATORY)
- NEVER run broad `grep`, `find`, or read multiple raw source files to map project architecture.
- Step 1: Always read `graphify-out/GRAPH_REPORT.md` first (< 800 tokens) to understand modules, central hubs, and dependencies.
- Step 2: Query `graphify-out/graph.json` (or run `graphify query "<question>"`) to locate targeted functions, classes, and call graphs.
- Step 3: When inspecting code, read ONLY the specific line ranges (`start_line` to `end_line`) identified by the graph instead of loading entire files.
- Whenever you introduce new modules or modify imports, run `graphify . --update` to refresh the graph.

## 2. Output & Log Compression via Headroom MCP (MANDATORY)
- Whenever running tests (`pytest`), CLI commands, backtests, or API queries that output more than 30 lines, NEVER dump raw stdout/stderr directly into context.
- Pass verbose logs or JSON payloads through the `headroom_compress` MCP tool before analyzing errors.
- Call `headroom_retrieve` if you need a specific omitted stack frame or dictionary key rather than re-running the command.

## 4. Token Compression & Algorithmic Coding Standards (STRICT)
- **Zero Conversational Fluff:** Eliminate all pleasantries, intros, and wrap-ups. Explanations must be dense, direct, and technically precise.
- **Unabridged Code Output:** ZERO CODE TRUNCATION. Never output `// TODO`, `/* rest of logic */`, or placeholders. Every stochastic model, data ingestion script, and component must be fully and completely implemented.
- **Statistical Honesty & Precision:** Maintain absolute statistical honesty in all quantitative models. Do not omit fee profiles, spread modeling, exception handling for live market feeds, or risk guardrails.
- **Execution Safety:** Default to dry-runs for all execution logic and order routing.
- **Verification:** Enforce a compile check on modified files before concluding a turn. State the file name, target line range, technical rationale, and the exact code diff. Done.

## 4. Caveman Output Compression (STRICT OUTPUT PROTOCOL)
- Speak like caveman. Direct, terse, high signal.
- Zero pleasantries, no padding, no conversational filler ("Certainly!", "I will now...").
- Silent tool execution: Never narrate what tool or file you are about to run; just execute it.
- Minimal diffs only: When modifying code, output only targeted search/replace blocks or changed functions. Never reprint unchanged files.
- Drop low-information articles, filler conjunctions, and decorative words.
- State fact, file, line number, exact code fix, done.
- Preserve 100% technical accuracy, formulas, exact symbol names, code diffs, and AST commands. Never truncate or compress code syntax.
- Maximum density. Minimum output tokens.
