# Test Bot — Umrah Webhook Lab

A small standalone chat sandbox for sending questions to the existing Umrah tenant chatbot webhook and displaying the actual backend response.

## Webhook contract
- URL: `https://leads.amaavigo.com/api/webhooks/chatbot/{webhookId}`
- Auth: `Authorization: Bearer {apiSecret}`
- `GET` verifies credentials; `POST` sends `{ message, conversationId?, history, visitor }`.
- Find tenant credentials in Umrah Lead Generation → Settings → Chatbot Integration.

## Vercel environment
Required: `AI_BOT_ACCESS_PASSWORD` (long random password). Optional server-side credentials: `UMRAH_CHATBOT_WEBHOOK_URL` and `UMRAH_CHATBOT_API_SECRET` (set both or neither). Optional origin allowlist: `UMRAH_ALLOWED_WEBHOOK_ORIGINS`, default `https://leads.amaavigo.com`.

When server-side webhook vars are absent, credentials can be entered into the UI and are held only in the current tab's memory. They are sent over HTTPS to this app's proxy and are not stored in browser storage or logged.

Node.js 22.x. No external npm dependencies or frontend build step.
