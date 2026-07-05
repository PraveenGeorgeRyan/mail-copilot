# Mail Copilot

A mail web application where an **AI assistant controls the UI** through natural language.
It is not a chatbot that talks *about* your email — it drives the interface: say
*"send an email to john@example.com about tomorrow's meeting"* and the compose form opens
and visibly fills in; say *"show unread emails from this week"* and the real inbox filters.

Built on the **Gmail API** with Google sign-in, so it operates on real mail — reading,
searching, sending, and replying with correct threading.

> **Live demo:** https://mail-copilot-red.vercel.app
> A screen-recording walkthrough of the assistant driving the UI is included with the
> submission.
>
> _Note: Google OAuth is in Testing mode, so live sign-in is limited to approved test
> users. To trial the live app, request test-user access._

![Mail Copilot screenshot](docs/screenshot-main.png)

---

## What it does

| # | Capability | How |
|---|---|---|
| 1 | **Real mail integration** — read, search, send, reply | Gmail API via `googleapis`, OAuth sign-in |
| 2 | **Assistant fills the compose form via natural language** | Frontend tool `composeEmail` + a visible typewriter fill |
| 3 | **Inbox & Sent show real data** | `messages.list` / `messages.get`, sanitized HTML rendering |
| 4 | **Assistant searches/filters and updates the MAIN UI** | Tool `applyFilters` writes the same store the UI renders from |
| 5 | **Context-aware** — "reply to this" knows the open email | Live app state streamed to the model via `useAgentContext` |
| 6 | **Real-time sync** — new mail appears with no refresh | 15s incremental `history.list` polling (see trade-offs) |
| 7 | **Filters via UI controls too** — sender, date, unread, search | Same store, same query builder as the assistant |

**Bonus features included:** reply & forward via the assistant · **human-in-the-loop
confirmation before sending** · **dark mode** · context-aware replies with proper
threading.

### Assistant commands you can try

- `show me my unread emails`
- `find the email from Google about verification`
- `open the latest email from Amazon`
- `send an email to john@example.com with subject 'Meeting Tomorrow' and body 'Let's meet at 3pm'`
- `reply to this saying thanks, I'll take a look` (while reading an email)
- `show emails from the last 10 days`

---

## Run it locally

**Prerequisites:** Node.js ≥ 20, a Google account, an OpenAI API key.

**1. Install**
```bash
git clone https://github.com/PraveenGeorgeRyan/mail-copilot.git
cd mail-copilot
npm install
```

**2. Google Cloud (OAuth + Gmail API)**
- Create a project at [console.cloud.google.com](https://console.cloud.google.com).
- **APIs & Services → Library** → enable **Gmail API** (and **Cloud Pub/Sub API** if you
  want to extend to push notifications).
- **OAuth consent screen** → External → **Testing** mode → add your Gmail as a **test user**
  (Testing mode needs no verification review).
- **Credentials → Create OAuth client ID → Web application**:
  - Authorized JavaScript origin: `http://localhost:3000`
  - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
- Copy the **Client ID** and **Client secret**.

**3. Environment**
```bash
cp .env.example .env.local
```
Fill in `.env.local`:
```
AUTH_SECRET=            # run: npx auth secret
AUTH_GOOGLE_ID=         # Google OAuth client ID
AUTH_GOOGLE_SECRET=     # Google OAuth client secret
OPENAI_API_KEY=         # platform.openai.com/api-keys
```

**4. Run**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in with the Google account you
added as a test user. Grant the two Gmail permissions when prompted.

---

## Architecture

Three layers with a strict, one-directional dependency chain:

```
components/assistant   → AI layer: registers tools & context for the LLM (CopilotKit)
        │                 (never calls Gmail directly)
        ▼
store/ + hooks/        → UI layer: Zustand store (single source of truth) + React Query
        │
        ▼
app/api/mail/*         → thin HTTP routes
        │
        ▼
lib/gmail/*            → pure mail-service core (parse, query, MIME, sync) — unit-tested
```

**The core idea:** one Zustand store describes everything on screen. Both the human UI
(buttons, filter inputs) and the AI assistant's tools mutate that *same* store, so
"the AI filters the inbox" and "the user clicks the Unread toggle" are the identical state
transition. The AI never gets privileged access — its tools are the same safe actions the
buttons call.

**How a command flows:** you type into the chat → CopilotKit sends your message plus the
tool schemas and a snapshot of the current app state to a runtime route → OpenAI
(`gpt-4o-mini`) responds with a *tool call* like `applyFilters({unreadOnly:true})` → the
tool's handler runs in your browser and updates the store → React Query (keyed off the
store's filters) refetches and the UI re-renders.

### Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 (class-strategy dark mode) |
| Mail | Gmail API (`googleapis`) |
| Auth | Auth.js v5 (Google OAuth, JWT sessions — no database) |
| AI | CopilotKit (v2 API) + OpenAI `gpt-4o-mini` |
| Client state | Zustand |
| Server data | TanStack React Query |
| Sanitization | `sanitize-html` |

---

## Key decisions & trade-offs

- **Next.js API routes instead of a separate backend.** The backend here is thin (OAuth, a
  Gmail wrapper) and both the Gmail SDK and CopilotKit are JavaScript-first. One repo, one
  language, shared types between client and server — no second service or CORS to manage.

- **CopilotKit for the AI layer.** Its hooks map directly onto the graded features:
  `useFrontendTool` (the AI's actions), `useAgentContext` (the AI's view of app state),
  `useHumanInTheLoop` (confirm-before-send). The v2 API runs on the Vercel AI SDK
  internally, which avoids the legacy provider adapters. The tool/store architecture is
  framework-agnostic, so this could be swapped for the raw AI SDK without touching the UI.

- **OpenAI `gpt-4o-mini` over a free model.** For a reliable graded demo, predictable
  behavior beats $0 — free tiers throttle unpredictably mid-conversation. The provider is a
  one-line change if needed.

- **Real-time = polling first.** New mail appears via a 15-second incremental
  `history.list` sync (2 quota units per call — negligible). This works identically on
  localhost and in production with no extra infrastructure. Genuine push (Gmail → Pub/Sub →
  webhook → browser) is the natural next tier and the code is structured for it; polling was
  chosen as the guaranteed baseline within the time budget.

- **JWT sessions, no database.** OAuth tokens live only in the encrypted session cookie and
  are never exposed to client JavaScript; server code reads them per-request. Simpler to run
  and deploy, at the cost of the token webhook path a persistent store would enable.

## Security notes

- Email HTML is **sanitized server-side** before it reaches the browser.
- Outgoing mail headers **strip CR/LF** to prevent header injection (e.g. a smuggled Bcc).
- OAuth tokens are **never sent to the browser** — only server code can decrypt the session.
- The AI can only call the registered tools (the same safe actions the UI uses); **sending
  requires an explicit human confirmation click**.

## Known limitations / what I'd improve with more time

- **Drafts don't survive a page refresh** — the compose draft lives in browser memory. I'd
  sync to the Gmail Drafts API.
- **Real-time is polling, not push** — I'd add the Gmail `users.watch` → Pub/Sub → webhook →
  Pusher pipeline (structured for it already) so new mail arrives in ~1s.
- **OAuth is in Testing mode**, so only listed test users can sign in and refresh tokens
  expire after 7 days — fine for a demo, would need app verification for public use.
- **No pagination / thread grouping** in the list view yet; **broader test coverage** and
  optimistic UI for mark-read would be next.

## Testing

```bash
npm test        # 29 unit tests (Vitest) over the pure mail-service core
npm run build   # type-check + production build
```

Tests focus on the logic worth locking down — Gmail query building, MIME
construction (including reply threading and header-injection safety), and
payload parsing — because those pure functions in `lib/gmail/` are where a
subtle bug would silently corrupt real mail.

---

Built as a take-home project. Stack chosen for pragmatic velocity: real API integration,
clean separation between mail service / UI / AI, and sensible error handling — not
over-engineered, not under-built.
