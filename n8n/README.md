# n8n workflows (owner: `feat/n8n-workflows`)

`main08-ops-webhook.workflow.json` — minimal starter: **Webhook (POST) → Process Payload → Respond to Webhook**.

1. n8n Cloud → *Workflows → Import from file* → pick the JSON above.
2. Open the Webhook node, copy the **Production URL** (activate the workflow first) and put it in `.env.local` as `N8N_WEBHOOK_URL`.
3. Verify: `curl -X POST "$N8N_WEBHOOK_URL" -H 'content-type: application/json' -d '{"workflow":"test","payload":{"scenario":"smoke"}}'` returns `{"message":"Workflow was started", ...}`.

The app POSTs `{ workflow, source, sentAt, payload }`; `payload` is the `rawPayload` from the agent's `n8nActionTriggered` plus `scenario`, `impact`, `confidenceScore`, `governance` (and `approvedByHuman: true` after a human click).
Extend the workflow after the challenge reveal (Slack/Gmail/Sheets/CRM nodes), export it, and commit the JSON here — never commit credentials.
