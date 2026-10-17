# Party Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest shared Party flow that lets three devices join, close membership, submit flexible questionnaire answers, and automatically reach `READY_FOR_THEME`.

**Architecture:** Replace the obsolete mission-oriented contract with a three-state Party aggregate. Issue an opaque in-memory participant token on create/join, keep secrets outside the public snapshot, and derive state transitions synchronously after each accepted command. Expose the aggregate through the existing Node HTTP server and use polling for multi-device updates.

**Tech Stack:** Node.js 22, TypeScript 5, npm workspaces, Node built-in HTTP server, Node built-in test runner, OpenAPI 3.1.

**Spec:** `docs/superpowers/specs/2026-10-17-party-foundation-design.md`

## Global Constraints

- Support two to four participants; the pitch uses three devices.
- Keep Party state, access tokens, and MCP keys in memory only.
- Only the host can close an `OPEN` Party.
- After membership closes, transitions happen automatically from participant actions.
- Questionnaire answers remain `Record<string, unknown>` and carry a version.
- Never expose participant tokens or MCP keys through `PartySnapshot`, logs, fixtures, or errors.
- Stop this slice at `READY_FOR_THEME`; theme, voting, menus, orders, delivery, and recap stay out of scope.
- Keep `Ifood apresentação_original.txt` and `index-v2.html` outside Git.

## Review Focus

- A fourth participant may join, but the fifth receives `PARTY_FULL`; covered in Task 2 service tests.
- A non-host attempting to close the group receives `HOST_ONLY`; covered in Task 2 service tests.
- A participant cannot submit answers for another participant; covered in Task 2 access tests.
- Replacing an already complete answer must not move the Party backward from `READY_FOR_THEME`; covered in Task 2 transition tests.
- API responses and errors must never contain the submitted MCP key; covered in Task 4 HTTP tests.

---

### Task 1: Replace the shared domain contract

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `fixtures/party.json`
- Modify: `README.md`
- Modify: `docs/adr/0001-uma-sessao-mcp-por-participante.md`
- Modify: `docs/tarefas-iniciais.md`

**Interfaces:**
- Consumes: no code interfaces; the approved design spec is the source of truth.
- Produces: `PartyStatus`, `PartySnapshot`, `Participant`, `QuestionnaireResponse`, `CreatePartyRequest`, `JoinPartyRequest`, `SubmitAnswersRequest`, `PartySessionResponse`, and `McpConnectionStatus`.

- [ ] **Step 1: Replace the obsolete states and types**

Define:

```ts
type PartyStatus = "OPEN" | "COLLECTING_ANSWERS" | "READY_FOR_THEME"
type McpConnectionStatus = "not_connected" | "validating" | "connected" | "error"

interface QuestionnaireResponse {
  questionnaireVersion: string
  answers: Record<string, unknown>
  completed: true
  submittedAt: string
}
```

`Participant` contains `id`, `name`, `questionnaireResponse`, and `mcpConnectionStatus`. `PartySnapshot` contains only `party` and `participants`. Remove mission, role, cart, order, and resolver types from this slice.

- [ ] **Step 2: Define command and session response types**

Add exact public interfaces:

```ts
interface PartySessionResponse {
  party: PartySnapshot
  participantToken: string
}

interface SubmitAnswersRequest {
  questionnaireVersion: string
  answers: Record<string, unknown>
  completed: true
}
```

Keep `participantId` out of private command bodies because the Bearer token identifies the actor.

- [ ] **Step 3: Replace the demo fixture**

Make `fixtures/party.json` represent three participants in `COLLECTING_ANSWERS`, with two complete responses and one `null` response. Include only public fields.

- [ ] **Step 4: Mark the previous concept as superseded**

Update `README.md`, the MCP session ADR, and the team task document so other agents do not implement missions, semantic roles, or the game loop. Describe the current product only as a shared Party that derives a theme from group answers and builds compatible local menus. Link the design spec and keep undecided behavior explicitly outside this slice.

- [ ] **Step 5: Verify the contract compiles**

Run: `npm run build --workspace @sidequest/contracts`

Expected: TypeScript exits with status 0.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/index.ts fixtures/party.json README.md docs/adr/0001-uma-sessao-mcp-por-participante.md docs/tarefas-iniciais.md
git commit -m "refactor: focus party contract on shared onboarding"
```

### Task 2: Implement access tokens, membership, and automatic transitions

**Files:**
- Create: `apps/api/src/party/access.ts`
- Create: `apps/api/src/party/service.test.ts`
- Modify: `apps/api/src/party/service.ts`
- Modify: `apps/api/src/party/store.ts`
- Modify: `apps/api/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 contracts.
- Produces: `ParticipantAccessStore.issue`, `ParticipantAccessStore.resolve`, `PartyService.create`, `PartyService.join`, `PartyService.closeMembership`, `PartyService.submitAnswers`, and `PartyService.get`.

- [ ] **Step 1: Write failing tests for membership and authorization**

In `service.test.ts`, cover these assertions:

```ts
assert.equal(created.party.party.status, "OPEN")
assert.notEqual(created.participantToken, "")
assert.equal(joined.party.participants.length, 4)
assert.throws(() => joinFifth(), { code: "PARTY_FULL" })
assert.throws(() => closeAsGuest(), { code: "HOST_ONLY" })
assert.equal(closed.party.status, "COLLECTING_ANSWERS")
assert.throws(() => joinAfterClose(), { code: "PARTY_CLOSED" })
```

- [ ] **Step 2: Run the service test and confirm it fails**

Run: `npm run build && node --test apps/api/dist/party/service.test.js`

Expected: FAIL because the new access and Party methods do not exist.

- [ ] **Step 3: Implement `ParticipantAccessStore`**

Expose:

```ts
issue(partyId: string, participantId: string): string
resolve(token: string): { partyId: string; participantId: string } | undefined
```

Generate tokens with `randomBytes(32).toString("base64url")`. Store only a SHA-256 digest as the map key.

- [ ] **Step 4: Implement create, join, and close membership**

Use signatures:

```ts
create(input: CreatePartyRequest): PartySessionResponse
join(idOrCode: string, input: JoinPartyRequest): PartySessionResponse
closeMembership(idOrCode: string, actorToken: string): PartySnapshot
```

Require 2–4 participants to close. Compare the resolved actor with `hostParticipantId`. Once closed, reject new participants.

- [ ] **Step 5: Write failing tests for questionnaire isolation and transition**

Cover:

```ts
assert.throws(() => submitWithForeignToken(), { code: "ACCESS_DENIED" })
assert.equal(afterFirst.party.status, "COLLECTING_ANSWERS")
assert.equal(afterLast.party.status, "READY_FOR_THEME")
assert.equal(afterReplacement.party.status, "READY_FOR_THEME")
assert.deepEqual(afterReplacement.participants[0].questionnaireResponse?.answers, replacement)
```

- [ ] **Step 6: Implement answer submission and reconciliation**

Use:

```ts
submitAnswers(
  idOrCode: string,
  actorToken: string,
  input: SubmitAnswersRequest,
): PartySnapshot
```

Accept answers only after membership closes. Set `submittedAt` on the server. After saving, call a private `reconcileStatus(snapshot)` that changes `COLLECTING_ANSWERS` to `READY_FOR_THEME` exactly when every participant has a complete response; never move backward.

- [ ] **Step 7: Add and run the test scripts**

Root `package.json`:

```json
"test": "npm run build && npm run test --workspace @sidequest/api"
```

API `package.json`:

```json
"test": "node --test dist/party/service.test.js"
```

Run: `npm test`

Expected: all service tests pass.

- [ ] **Step 8: Commit**

```bash
git add package.json apps/api/package.json apps/api/src/party
git commit -m "feat: add secure multiuser party onboarding"
```

### Task 3: Publish the multi-device HTTP API

**Files:**
- Create: `apps/api/src/http/server.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/openapi.yaml`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: Task 2 Party service and Bearer token resolution.
- Produces: `createPartyServer(service, options)`, public polling endpoint, and four command endpoints.

- [ ] **Step 1: Write failing HTTP contract tests**

Start the server on port `0` and cover:

```text
POST /parties                         → 201 PartySessionResponse
POST /parties/:id/join                → 200 PartySessionResponse
POST /parties/:id/close               → 200 PartySnapshot
POST /parties/:id/answers             → 200 PartySnapshot
GET  /parties/:id                     → 200 PartySnapshot without tokens
```

Assert `401 ACCESS_TOKEN_REQUIRED` without `Authorization: Bearer ...`, `403 ACCESS_DENIED` with a token from another Party, and configured CORS headers for both success and error responses.

- [ ] **Step 2: Run the HTTP tests and confirm they fail**

Run: `npm run build && node --test apps/api/dist/http/server.test.js`

Expected: FAIL because `createPartyServer` and the new routes do not exist.

- [ ] **Step 3: Extract a testable server factory**

Implement:

```ts
createPartyServer(
  service: PartyService,
  options: { allowedOrigin: string },
): Server
```

Keep `server.listen` in a small entrypoint section. Read `CORS_ORIGIN`, defaulting to `http://localhost:5173` for development.

- [ ] **Step 4: Replace obsolete routes**

Remove `/plan`, `/ready`, `/order-status`, and product-facing `/advance`. Add `/close` and make `/answers` derive the participant from the Bearer token. Preserve `GET /health` and public `GET /parties/:id` for polling.

- [ ] **Step 5: Rewrite the OpenAPI contract**

Document the three states, `PartySessionResponse`, Bearer authentication, generic answers, error codes, participant limit, and polling behavior. Do not document future theme or ordering routes.

- [ ] **Step 6: Run the API tests**

Update the API test script to run both compiled test files, then run `npm test`.

Expected: all service and HTTP tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/server.ts apps/api/src/http/server.test.ts apps/api/openapi.yaml apps/api/package.json
git commit -m "feat: expose party onboarding API"
```

### Task 4: Add the private MCP connection boundary

> Nota (pós-implementação): este task constrói um placeholder de `apiKey`. O iFood MCP real
> conecta por OAuth 2.1 por participante; ver [`docs/ifood-mcp.md`](../../ifood-mcp.md) e o
> [ADR 0001](../../adr/0001-uma-sessao-mcp-por-participante.md). O `McpSessionRegistry` deve ser
> substituído por um registro de tokens.

**Files:**
- Create: `apps/api/src/mcp/session-registry.ts`
- Create: `apps/api/src/mcp/session-registry.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/http/server.test.ts`
- Modify: `apps/api/openapi.yaml`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: Task 2 participant access tokens.
- Produces: `McpSessionRegistry.set`, `McpSessionRegistry.get`, `McpSessionRegistry.deleteParty`, `PartyService.setMcpConnectionStatus`, and `POST /parties/:id/mcp-connection`.

- [ ] **Step 1: Write failing registry tests**

Assert that `set(partyId, participantId, apiKey)` stores separate values for two participants, replacement affects only its owner, and `deleteParty(partyId)` removes every key for that Party.

- [ ] **Step 2: Run the registry test and confirm it fails**

Run: `npm run build && node --test apps/api/dist/mcp/session-registry.test.js`

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement the private registry**

Expose:

```ts
set(partyId: string, participantId: string, apiKey: string): void
get(partyId: string, participantId: string): string | undefined
deleteParty(partyId: string): void
```

Reject blank keys. Keep the map private and provide no listing or serialization method.

- [ ] **Step 4: Write failing HTTP secrecy tests**

Submit a distinctive key to `POST /parties/:id/mcp-connection`. Assert the response, subsequent `GET /parties/:id`, and every error body do not contain that string. Assert a token from another participant or Party cannot replace the connection.

- [ ] **Step 5: Implement the MCP connection endpoint**

Accept `{ "apiKey": "..." }` over an authenticated request. Store it for the resolved participant, call:

```ts
setMcpConnectionStatus(
  idOrCode: string,
  actorToken: string,
  status: McpConnectionStatus,
): PartySnapshot
```

with `validating`, and return `{ "status": "validating" }`. A subsequent public `GET /parties/:id` must show `validating` only for that participant. Do not claim `connected` until Maeda supplies a real validator.

- [ ] **Step 6: Update OpenAPI and run the full suite**

Document that the key is write-only and the current response is `validating`.

Run: `npm test`

Expected: all tests pass and test output contains no API key.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/mcp apps/api/src/server.ts apps/api/src/http/server.test.ts apps/api/openapi.yaml apps/api/package.json
git commit -m "feat: add private MCP session registry"
```

### Task 5: Prepare the handoff and first three-device rehearsal

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `compose.yaml`
- Create: `Caddyfile`
- Create: `docs/rehearsal-party-foundation.md`
- Modify: `docs/desenvolvimento.md`

**Interfaces:**
- Consumes: Tasks 1–4 HTTP API.
- Produces: deployable container and an exact rehearsal checklist for the team.

- [ ] **Step 1: Add the production container**

Use a two-stage Node 22 Alpine build. The build stage runs `npm ci` and `npm run build`; the runtime stage copies production dependencies and compiled workspace output, exposes `3333`, and starts `npm run start:api`.

- [ ] **Step 2: Add HTTPS composition for Oracle**

Define `compose.yaml` with one API replica and Caddy as the only public service. Bind Caddy to ports 80 and 443, proxy `{$API_HOST}` to `api:3333`, and pass `CORS_ORIGIN` to the API. Do not publish port 3333 from the API container.

- [ ] **Step 3: Build the container**

Run: `docker build -t sidequest-party-api .`

Expected: image builds successfully and contains neither local reference file.

- [ ] **Step 4: Deploy the slice to Oracle**

On the Oracle host, point the chosen DNS name to the instance and run:

```bash
API_HOST=<api-domain> CORS_ORIGIN=<frontend-origin> docker compose up -d --build
curl https://<api-domain>/health
```

Expected: Caddy provisions HTTPS and health returns `{ "status": "ok" }`. Keep the concrete domain in the host environment, outside Git.

- [ ] **Step 5: Write the rehearsal checklist**

Document exact commands and observable results for:

1. health check over the public HTTPS URL;
2. host creates a Party on device A;
3. devices B and C join with the code;
4. host closes membership;
5. all devices observe `COLLECTING_ANSWERS` through polling;
6. each device submits different generic answers;
7. all devices observe `READY_FOR_THEME` after the last response;
8. each participant registers a distinct fake key and no response exposes it.

- [ ] **Step 6: Update the developer handoff**

Link the new spec, OpenAPI file, ADR, and rehearsal. Tell Otávio to keep the participant token in `sessionStorage` and poll every 1–2 seconds. Tell Maeda to replace `validating` through the private registry boundary without changing public Party state.

- [ ] **Step 7: Run final verification**

Run: `npm test && npm run build`

Expected: all tests pass and both workspaces compile.

- [ ] **Step 8: Commit**

```bash
git add Dockerfile .dockerignore compose.yaml Caddyfile docs/rehearsal-party-foundation.md docs/desenvolvimento.md
git commit -m "docs: prepare multi-device party rehearsal"
```
