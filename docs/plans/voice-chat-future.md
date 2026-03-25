# Voice chat in the chat dock — assessment (future feature)

**Status:** Idea / not implemented.  
**Audience:** Product, contributors, AI agents.

This document captures complexity and options for **in-window voice** alongside existing **text** stage/event chat. No code in this repo implements voice today.

---

## What exists today

- **Messages:** `GET` / `POST` `/api/v1/chat/messages` with `eventId`, `scope: "stage" | "event"`, and `stageId` when scope is stage (`api/src/routes/v1/chat.ts`, `stage_chat_messages` in schema).
- **Live text:** SSE + `broadcastChatMessage` invalidates TanStack and can push an instant payload (`docs/REALTIME.md`).
- **Presence:** In-memory per event (`api/src/lib/chat-presence.ts`) — single API process limitation is documented.
- **UI:** `StageChatDock` uses `sendScope` + `contextStageId` (`web/src/components/StageChatDock.tsx`).

There is **no** WebRTC stack, **no** media server, and **no** dedicated chat WebSocket (spreadsheet collab uses WebSockets separately).

---

## Keeping voice rooms separate

**Conceptually straightforward.** Define stable room identifiers, for example:

- **Stage room:** `voice:{eventId}:stage:{stageId}`
- **Event room:** `voice:{eventId}:event`

Only peers using the **same** scope (and for stage, the **same** `contextStageId`) join the same signaling and media group — aligned with how chat messages are scoped.

**Product note:** Text `GET` returns both event-wide and stage messages in one list. Voice should **not** mix audio unless that is an explicit product choice; it should follow **This stage** vs **Whole event** like `sendScope`.

---

## What voice requires technically

| Piece | Role | Effort / risk |
|--------|------|----------------|
| **Signaling** | Exchange SDP and ICE candidates | New WebSocket (or similar) routes; in-memory room registry OK for **one** API replica; multi-replica needs shared bus (see `REALTIME.md`). |
| **STUN** | NAT discovery | Low — public or self-hosted STUN URLs in `RTCPeerConnection` config. |
| **TURN** | Relay when paths fail | Often needed for real-world phones / double NAT; operational cost (e.g. coturn, credentials, TLS). Without TURN, LAN-only demos may still fail for some users. |
| **Topology** | Who hears whom | **Mesh** (each-to-each): tolerable for a few peers; degrades as N grows. **SFU** (e.g. mediasoup, LiveKit): better scale, but new container/service and ongoing ops. |
| **Client UX** | Mic permission, mute, join/leave, reconnect | Significant work in the dock, especially **iOS Safari** behaviour and background tabs. |
| **Consent / safety** | Open LAN | Clear mic-on indicator; avoid silent join. |

---

## Complexity verdict

- **Separate rooms matching chat scope:** Easy to specify.
- **Ship trustworthy in-window voice:** **Medium to large** — signaling + UX + **TURN** and topology choices dominate effort.
- **Rough scale:** A **minimal mesh** prototype (two users, same network, no TURN) might be days; something suitable for **show use** (TURN, reconnect, mobile, small groups) is more like **multiple weeks** plus documentation updates if it ships.

---

## Alternatives

- **External voice:** Link to Discord, FaceTime, venue intercom, etc. — no WebRTC in-repo; “room” is whichever link or channel you standardise per stage/event.
- **Recording clips:** Not a substitute for real-time voice.

---

## Related docs

- [`docs/REALTIME.md`](../REALTIME.md) — SSE vs WebSocket split; chat presence; single-process limitations.
- [`docs/ROADMAP.md`](../ROADMAP.md) — product backlog (this idea is listed under post-MVP ideas).
