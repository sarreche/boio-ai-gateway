# AI Gateway

Internal, provider-independent gateway that exposes an OpenAI-like API for chat completions and embeddings, plus typed evaluations. Consumer applications use the public model name `gateway`; provider names, real models, credentials, priority, and fallback remain internal.

See [docs/SPEC.md](docs/SPEC.md) for the complete project specification.

## Requirements

- Node.js 20.9 or newer
- Provider API keys for the enabled entries in `config/models.json`

## Installation

```bash
npm install
cp .env.example .env.local
```

On PowerShell, copy the environment template with `Copy-Item .env.example .env.local`.

## Configuration

Set the following values in `.env.local` (never commit this file):

```env
GATEWAY_API_KEYS=key_for_app_one,key_for_app_two
GROQ_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=
VERCEL_GATEWAY_API_KEY=
AI_PROVIDER_TIMEOUT_MS=30000
```

Provider priority, endpoints, enabled status, and real model names live only in `config/models.json`. Every enabled provider must have its referenced environment variable. Disable providers you do not intend to configure. Changing a model requires only a configuration edit.

The initial priority is Groq, OpenRouter, then Gemini for chat; Gemini for embeddings; and Vercel AI Gateway for evaluations with Jev. Availability and free-tier limits can change; verify provider terms before production use.

## Local development

```bash
npm run dev
```

Open `http://localhost:3000` for API documentation. Public endpoints are:

- `GET /health` (no authentication)
- `POST /v1/chat/completions`
- `POST /v1/embeddings`
- `POST /v1/evaluations`

All `/v1/*` requests require `Authorization: Bearer <gateway-key>`. The public `model` may be omitted or set to `gateway`/`default`; it never selects or exposes a provider model. Streaming is intentionally unsupported.

### Typed evaluations

`POST /v1/evaluations` evaluates one shared text or JSON state against one or more independent questions. It supports Jev's three primitives: `boolean`, `choice`, and `score`. The real model and Vercel routing, cost, and generation metadata are never returned.

```bash
curl http://localhost:3000/v1/evaluations \
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gateway",
    "state": { "ticket": "My card was charged twice and I need a refund today." },
    "questions": {
      "refundRequested": {
        "type": "boolean",
        "instructions": "Is the customer asking for a refund?"
      },
      "route": {
        "type": "choice",
        "instructions": "Route this ticket.",
        "criteria": {
          "billing": "Payments, charges, or refunds",
          "technical": "Application errors"
        }
      },
      "urgency": {
        "type": "score",
        "instructions": "Rate the urgency.",
        "criteria": ["low", "medium", "high"]
      }
    }
  }'
```

Each answer preserves its primitive: booleans return `probability`, choices return `choice` and `probabilities`, and scores return an interpolated `score` and `probabilities` for each rung.

## Tests

```bash
npm test
```

Tests mock provider HTTP calls and never contact external APIs.

## Build

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Import the repository into Vercel.
2. Add `GATEWAY_API_KEYS` and every API key referenced by an enabled provider in `config/models.json`.
3. Optionally set `AI_PROVIDER_TIMEOUT_MS` (default: `30000`).
4. Deploy. Next.js uses the Node.js runtime and requires no additional infrastructure.

Use backend-to-backend requests. The gateway deliberately does not add permissive CORS headers or persistent rate limiting; provider limits apply.
