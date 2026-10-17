# Party Coordinator — Sprint 0 Implementation Plan

> **For SideQuest team:** Execute this plan in the current session, keeping the shared contract stable until the first checkpoint.

**Goal:** Deliver an in-memory Party API and shared TypeScript contracts so frontend and iFood agent work can proceed independently.

**Architecture:** An npm workspace exposes domain types from `packages/contracts` and runs a Node HTTP API from `apps/api`. The API owns the Party state machine and stores rooms in process memory. `fixtures/party.json` remains the canonical demo payload; `apps/api/openapi.yaml` documents the integration surface.

**Tech Stack:** Node.js 22, TypeScript, npm workspaces, Node built-in HTTP server, OpenAPI 3.1.

---

### Task 1: Establish the shared contract

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `fixtures/party.json`

Define Party states, questionnaire answers, participant state, semantic mission, resolved kits, API requests, and API errors. Preserve the fixture already agreed in `docs/tarefas-iniciais.md`.

### Task 2: Publish the HTTP contract

**Files:**
- Create: `apps/api/openapi.yaml`

Document the Sprint 0 endpoints, identifiers, expected bodies, success payloads, and common errors before implementing handlers.

### Task 3: Implement the Party state machine

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/party/store.ts`
- Create: `apps/api/src/party/service.ts`

Implement in-memory storage, state transitions, participant updates, readiness rules, order status updates, and controlled demo advancement. Keep MCP integration behind `ResolveKitInput` and `ResolveKitOutput` contracts.

### Task 4: Expose the API

**Files:**
- Create: `apps/api/src/server.ts`

Add JSON parsing, CORS, route dispatch, validation errors, health endpoint, and consistent JSON responses.

### Task 5: Document handoff

**Files:**
- Create: `docs/desenvolvimento.md`
- Modify: `docs/tarefas-iniciais.md`

Explain how Otávio consumes the API or fixture, where Maeda implements his adapter, and which files each person owns. Record decisions and current limitations.
