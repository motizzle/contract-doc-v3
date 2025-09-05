# LLM-backed Chatbot

## Summary
Introduce an LLM-backed chatbot that replaces scripted replies with real-time assistance while preserving current behavior by default. The feature is gated behind configuration and streams responses over existing SSE.

## Goals
- Provide helpful, domain-aware answers inside the app and Word add-in
- Preserve current dummy chatbot as fallback when disabled or on error
- Minimal UI changes; reuse existing chat UX and SSE channel
- Keep costs and risks contained via limits, timeouts, and feature flag

## Non-Goals
- No new UI framework or major redesign
- No persistence of full chat history beyond session scope (initial version)
- No vendor-specific lock-in; abstraction supports multiple providers later

## User Stories
- As an editor, I can ask the assistant to summarize a clause and see a streaming answer
- As a viewer, I can read assistant suggestions pushed to the thread without editing permissions
- As an admin, I can disable the assistant globally without code changes

## Architecture
- Server: add provider-agnostic module `server/src/lib/llm.js` with `generateReply({ messages, systemPrompt, stream })`
- Endpoint: enhance `POST /api/v1/events/client` for `type === "chat"` to call LLM when enabled, else fallback to scripted responses
- Streaming: send `chat:delta` and `chat:complete` events over existing `/api/v1/events` SSE
- Config: env flags (`LLM_ENABLED`, `OPENAI_API_KEY`, `OPENAI_MODEL`, optional `OPENAI_BASE_URL`, `LLM_SYSTEM_PROMPT`, `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`)

## Security & Privacy
- Secrets only via environment; never committed
- Truncate inputs; exclude sensitive attachments by default
- Rate limit per IP/user; server-side timeouts and retries

## Observability
- Log minimal metrics: latency, token counts, error rates (redacted content)
- Health: extend `/api/v1/health` with `llmEnabled` and `provider`

## Acceptance Criteria
- With `LLM_ENABLED=false`, behavior matches current scripted bot
- With `LLM_ENABLED=true` and valid key, assistant streams responses via SSE
- On provider error, user gets a graceful error message and scripted fallback
- No secrets in repo; docs explain enablement clearly

## Rollout Plan
- Feature branch `feat/llm-chat`
- Land behind flag default-off; merge to main
- Dogfood in dev; watch cost and latency; enable per environment
