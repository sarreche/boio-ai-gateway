> This document is the source of truth for the implementation.
> When implementation details conflict with this document,
> prefer this specification unless a technical limitation makes it impossible.

# AI Gateway — Especificación de implementación

## 1. Objetivo

Construir un API Gateway simple para centralizar el acceso de nuestras aplicaciones a modelos de inteligencia artificial.

El gateway debe ocultar completamente a las aplicaciones consumidoras:

- proveedor utilizado;
- modelo real utilizado;
- API key del proveedor;
- lógica de selección de modelo;
- fallback entre proveedores.

Las aplicaciones deben consumir únicamente nuestro gateway mediante una interfaz estable.

El sistema tendrá tres capacidades:

1. generación de texto/chat;
2. generación de embeddings.
3. evaluaciones tipadas para decisiones acotadas.

La API externa debe seguir, en la medida de lo razonable, el formato de la API de OpenAI/OpenRouter para facilitar su integración con SDKs y herramientas existentes.

No sobre-ingenierizar.

No utilizar base de datos.

La configuración debe residir en archivos versionados y las credenciales deben residir exclusivamente en variables de entorno.

---

# 2. Stack tecnológico

Implementar utilizando:

- Next.js
- TypeScript
- Next.js App Router
- Route Handlers
- Node.js runtime
- fetch nativo para comunicación HTTP
- Zod para validación de requests y configuración
- Vitest para tests unitarios

Deployment objetivo:

- Vercel

Evitar agregar frameworks adicionales como:

- Express
- NestJS
- Fastify
- Prisma
- Redis
- bases de datos
- colas
- workers

No utilizar infraestructura que no sea necesaria para este MVP.

---

# 3. Arquitectura general

La arquitectura conceptual debe ser:

```text
Application
     │
     │ Bearer API Key
     ▼
AI Gateway
     │
     ├── Authentication
     │
     ├── Request validation
     │
     ├── Model routing
     │
     └── Response normalization
            │
            ├── Groq
            ├── OpenRouter
            ├── Gemini
            └── futuros proveedores
```

Las aplicaciones consumidoras NUNCA deben especificar el modelo real.

Ejemplo:

```text
App
 │
 │ POST /v1/chat/completions
 ▼
Gateway
 │
 ├── selecciona proveedor
 ├── selecciona modelo
 ├── llama al proveedor
 └── normaliza respuesta
```

---

# 4. Principio fundamental

La interfaz pública debe permanecer estable aunque cambiemos los modelos internos.

Por ejemplo hoy podríamos utilizar:

```text
Groq
  ↓
modelo A
```

y mañana cambiar la configuración a:

```text
Gemini
  ↓
modelo B
```

sin modificar ninguna aplicación consumidora.

---

# 5. Endpoints públicos

Implementar inicialmente únicamente:

```text
GET  /health
POST /v1/chat/completions
POST /v1/embeddings
POST /v1/evaluations
```

No agregar otros endpoints salvo que sean estrictamente necesarios.

## Evaluaciones tipadas

`POST /v1/evaluations` requiere Bearer API key y evalúa un `state` compartido contra una o más preguntas independientes. `state` acepta texto, objetos JSON o arrays JSON no vacíos. Las preguntas admiten las primitivas `boolean`, `choice` y `score`, que pueden combinarse en una misma solicitud.

El campo público `model` es opcional y sólo acepta `gateway` o `default`. Nunca selecciona ni revela el modelo real. La respuesta contiene `model: "gateway"`, `answers` y, cuando esté disponible, uso normalizado. No debe exponer el nombre real del modelo, IDs de generación, costos ni metadatos de routing del proveedor.

La capacidad se configura en `config/models.json` bajo `evaluations`. Inicialmente utiliza Vercel AI Gateway mediante `VERCEL_GATEWAY_API_KEY` y el modelo se define únicamente en configuración. Los tests deben cubrir las tres primitivas, preguntas mixtas, autenticación, validación y sanitización de metadatos internos.

---

# 6. Health check

## GET /health

No requiere autenticación.

Respuesta:

```json
{
  "status": "ok"
}
```

No revelar:

- API keys;
- modelos;
- proveedores;
- configuración interna.

---

# 7. Autenticación

Todos los endpoints `/v1/*` deben requerir:

```http
Authorization: Bearer <API_KEY>
```

Las API keys autorizadas deben configurarse mediante una variable de entorno.

Ejemplo:

```env
GATEWAY_API_KEYS=key_app_1,key_app_2,key_app_3
```

El gateway debe comprobar que el token recibido pertenece a esa lista.

Si falta:

```http
401 Unauthorized
```

Si es inválido:

```http
401 Unauthorized
```

Respuesta:

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

No guardar API keys de nuestras aplicaciones dentro del repositorio.

No implementar:

- usuarios;
- login;
- OAuth;
- JWT;
- sesiones;
- roles;
- permisos.

Para este proyecto, Bearer API Keys es suficiente.

---

# 8. Chat completions

Endpoint:

```text
POST /v1/chat/completions
```

Debe seguir un subconjunto razonable del formato OpenAI Chat Completions.

Ejemplo mínimo:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a useful assistant."
    },
    {
      "role": "user",
      "content": "Explain dependency injection."
    }
  ]
}
```

También aceptar:

```json
{
  "model": "gateway",
  "messages": [
    {
      "role": "user",
      "content": "Explain dependency injection."
    }
  ]
}
```

## Campo `model`

El campo `model` debe ser opcional.

Si no viene:

```text
usar routing interno
```

Si viene:

```json
{
  "model": "gateway"
}
```

debe aceptarse por compatibilidad con clientes OpenAI.

El valor enviado por el cliente NO determina el modelo real.

Inicialmente aceptar:

```text
gateway
default
```

y utilizar siempre el modelo configurado internamente.

Esto permite que una aplicación basada en OpenAI SDK pueda hacer conceptualmente:

```typescript
client.chat.completions.create({
  model: "gateway",
  messages
})
```

sin conocer el modelo real.

---

# 9. Parámetros soportados para chat

MVP:

```typescript
{
  model?: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
  stream?: false;
}
```

Roles soportados:

```text
system
user
assistant
```

Mantener la implementación pequeña.

No implementar inicialmente:

- multimodal;
- imágenes;
- audio;
- files;
- tool calling;
- function calling;
- reasoning controls;
- web search;
- structured outputs específicos de proveedor.

Estos pueden agregarse posteriormente.

---

# 10. Streaming

No implementar streaming en el MVP.

Si se recibe:

```json
{
  "stream": true
}
```

responder:

```http
400 Bad Request
```

indicando:

```json
{
  "error": {
    "message": "Streaming is not supported",
    "type": "invalid_request_error",
    "code": "unsupported_streaming"
  }
}
```

Esto evita agregar complejidad innecesaria inicialmente.

---

# 11. Respuesta de chat

Normalizar la respuesta para que tenga formato similar a OpenAI.

Ejemplo:

```json
{
  "id": "chatcmpl_xxxxx",
  "object": "chat.completion",
  "created": 1750000000,
  "model": "gateway",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Dependency injection is..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

IMPORTANTE:

```json
"model": "gateway"
```

No devolver públicamente el nombre real del modelo utilizado.

Si el proveedor no devuelve métricas de tokens, `usage` puede omitirse.

---

# 12. Embeddings

Endpoint:

```text
POST /v1/embeddings
```

Seguir un formato compatible con OpenAI.

Aceptar:

```json
{
  "input": "Texto que quiero convertir a embedding."
}
```

También aceptar múltiples textos:

```json
{
  "input": [
    "Texto número uno",
    "Texto número dos"
  ]
}
```

Para compatibilidad también aceptar:

```json
{
  "model": "gateway",
  "input": "Texto que quiero convertir."
}
```

Nuevamente, `model` no determina el modelo real.

---

# 13. Respuesta de embeddings

Ejemplo:

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [
        0.0123,
        -0.0372,
        0.9912
      ]
    }
  ],
  "model": "gateway",
  "usage": {
    "prompt_tokens": 12,
    "total_tokens": 12
  }
}
```

Si hay múltiples inputs:

```text
data[0]
data[1]
data[2]
...
```

deben preservar el orden recibido.

---

# 14. Configuración

Crear:

```text
config/models.json
```

Toda la selección de modelos debe poder modificarse desde este archivo sin cambiar código.

Ejemplo:

```json
{
  "chat": {
    "strategy": "priority",
    "providers": [
      {
        "id": "groq-primary",
        "type": "openai-compatible",
        "baseUrl": "https://api.groq.com/openai/v1",
        "apiKeyEnv": "GROQ_API_KEY",
        "model": "MODEL_NAME_HERE",
        "enabled": true,
        "priority": 1
      },
      {
        "id": "openrouter-fallback",
        "type": "openai-compatible",
        "baseUrl": "https://openrouter.ai/api/v1",
        "apiKeyEnv": "OPENROUTER_API_KEY",
        "model": "MODEL_NAME_HERE",
        "enabled": true,
        "priority": 2
      }
    ]
  },

  "embeddings": {
    "strategy": "priority",
    "providers": [
      {
        "id": "gemini-embeddings",
        "type": "gemini",
        "apiKeyEnv": "GEMINI_API_KEY",
        "model": "gemini-embedding-001",
        "enabled": true,
        "priority": 1
      }
    ]
  }
}
```

Los nombres concretos de los modelos deben poder cambiarse desde este archivo.

---

# 15. Secrets

NUNCA incluir secrets en:

```text
models.json
```

Utilizar referencias al nombre de la variable:

```json
{
  "apiKeyEnv": "GROQ_API_KEY"
}
```

y resolver luego:

```typescript
process.env[provider.apiKeyEnv]
```

Ejemplo `.env.example`:

```env
GATEWAY_API_KEYS=

GROQ_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=
```

`.env` y `.env.local` deben estar en `.gitignore`.

---

# 16. Routing de proveedores

Implementar únicamente una estrategia inicialmente:

```text
priority
```

Ejemplo:

```text
priority 1 → Groq
priority 2 → OpenRouter
priority 3 → Gemini
```

Ordenar proveedores habilitados por prioridad.

Intentar el primero.

Si funciona:

```text
retornar respuesta
```

Si falla por un error recuperable:

```text
intentar siguiente proveedor
```

Errores considerados recuperables:

```text
408
429
500
502
503
504
network error
timeout
```

Errores 4xx provocados por el request del cliente NO deben generar fallback, excepto 408/429.

Ejemplos:

```text
400 → devolver error
401 interno proveedor → tratar como configuración incorrecta
429 → intentar fallback
500 → intentar fallback
```

---

# 17. Timeout

Cada llamada a proveedor debe tener timeout.

Valor configurable:

```text
AI_PROVIDER_TIMEOUT_MS
```

Default razonable:

```text
30000
```

Usar:

```typescript
AbortController
```

No agregar librerías solamente para manejar timeouts.

---

# 18. Provider abstraction

Crear una abstracción mínima.

Conceptualmente:

```typescript
interface ChatProvider {
  chat(request: ChatRequest): Promise<ChatResult>;
}

interface EmbeddingProvider {
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
}
```

No crear una arquitectura de plugins compleja.

Inicialmente son suficientes dos adaptadores:

```text
OpenAICompatibleProvider
GeminiProvider
```

`OpenAICompatibleProvider` debe poder servir para proveedores como:

```text
Groq
OpenRouter
otros OpenAI-compatible
```

únicamente cambiando:

```text
baseUrl
apiKey
model
```

---

# 19. Separar modelos internos de modelos públicos

Nunca exponer:

```text
llama-...
gemini-...
qwen-...
mistral-...
```

al consumidor.

Públicamente el modelo es siempre:

```text
gateway
```

Internamente:

```text
gateway
   │
   └── configuración
         │
         └── proveedor/modelo real
```

---

# 20. Logging

Agregar logging mínimo utilizando `console`.

Registrar:

```text
requestId
endpoint
providerId
durationMs
status
fallbackUsed
```

Ejemplo:

```json
{
  "requestId": "req_abc123",
  "endpoint": "chat",
  "provider": "groq-primary",
  "durationMs": 423,
  "status": "success",
  "fallbackUsed": false
}
```

NO registrar:

- Authorization header;
- API keys;
- prompts completos;
- embeddings;
- contenido potencialmente privado.

---

# 21. Request ID

Generar un identificador por request:

```typescript
crypto.randomUUID()
```

Devolverlo además como header:

```http
X-Request-Id: ...
```

Esto permitirá depurar requests usando los logs de Vercel.

---

# 22. Errores

Normalizar errores.

Formato:

```json
{
  "error": {
    "message": "Human readable error",
    "type": "invalid_request_error",
    "code": "invalid_request"
  }
}
```

Casos:

```text
400 invalid_request
401 authentication_error
429 rate_limit_error
500 gateway_error
502 provider_error
504 provider_timeout
```

No devolver stack traces.

No devolver errores crudos del proveedor si contienen información interna.

---

# 23. Validación

Utilizar Zod para validar:

- requests;
- archivo `models.json`;
- valores requeridos;
- configuración de providers.

La aplicación debe fallar de manera clara al arrancar/desplegar si `models.json` es inválido.

Por ejemplo:

```text
Provider "groq-primary" references missing environment variable GROQ_API_KEY
```

No revelar el valor de la variable.

---

# 24. Rate limiting

NO implementar rate limiting persistente en esta primera versión.

La autenticación mediante API key y los límites de los proveedores son suficientes para el MVP.

Dejar claramente documentado como mejora futura.

No introducir Redis solamente por esto.

---

# 25. CORS

Por defecto no abrir:

```http
Access-Control-Allow-Origin: *
```

El gateway está pensado principalmente para comunicación:

```text
backend → backend
```

Si posteriormente una aplicación web necesita llamar directamente al gateway desde el navegador, agregar una whitelist configurable.

No hacerlo inicialmente salvo necesidad.

---

# 26. Seguridad

Aplicar al menos:

- Bearer API Key;
- secrets exclusivamente en environment variables;
- no loguear prompts;
- no loguear API keys;
- validación de inputs;
- límite de tamaño de body;
- timeout de proveedores;
- mensajes de error sanitizados.

Definir un tamaño máximo razonable de request.

Por ejemplo:

```text
1 MB
```

Rechazar requests mayores.

---

# 27. Estructura sugerida

Mantener la estructura simple:

```text
/
├── app
│   ├── api
│   │   ├── health
│   │   │   └── route.ts
│   │   │
│   │   └── v1
│   │       ├── chat
│   │       │   └── completions
│   │       │       └── route.ts
│   │       │
│   │       └── embeddings
│   │           └── route.ts
│   │
│   └── page.tsx
│
├── config
│   └── models.json
│
├── lib
│   ├── auth.ts
│   ├── config.ts
│   ├── errors.ts
│   ├── logger.ts
│   ├── routing.ts
│   │
│   ├── schemas
│   │   ├── chat.ts
│   │   └── embeddings.ts
│   │
│   └── providers
│       ├── types.ts
│       ├── openai-compatible.ts
│       └── gemini.ts
│
├── tests
│
├── .env.example
├── README.md
├── package.json
└── tsconfig.json
```

Evitar crear capas adicionales sin necesidad.

---

# 28. Página raíz

La página:

```text
/
```

debe mostrar documentación sencilla y legible.

No necesitamos un portal complejo.

Mostrar:

```text
AI Gateway
```

con:

- descripción;
- autenticación;
- endpoint de chat;
- endpoint de embeddings;
- ejemplos curl;
- ejemplos JavaScript/TypeScript;
- códigos de error.

Puede ser una página Next.js sencilla.

No instalar una plataforma de documentación externa.

---

# 29. README

Crear un README completo.

Debe explicar:

## Qué es

Gateway interno para normalizar acceso a modelos AI.

## Instalación

```bash
npm install
```

## Configuración

```bash
cp .env.example .env.local
```

## Desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Deployment en Vercel

Explicar:

1. importar repositorio;
2. configurar environment variables;
3. desplegar.

---

# 30. Documentar uso con curl

## Chat

```bash
curl https://my-gateway.vercel.app/v1/chat/completions \
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What is dependency injection?"
      }
    ]
  }'
```

También:

```bash
curl https://my-gateway.vercel.app/v1/chat/completions \
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gateway",
    "messages": [
      {
        "role": "user",
        "content": "What is dependency injection?"
      }
    ]
  }'
```

---

# 31. Documentar embeddings

```bash
curl https://my-gateway.vercel.app/v1/embeddings \
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "This is some text"
  }'
```

---

# 32. Compatibilidad con OpenAI SDK

El diseño debe permitir utilizar aproximadamente:

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.MY_GATEWAY_API_KEY,
  baseURL: "https://my-gateway.vercel.app/v1"
});

const result = await client.chat.completions.create({
  model: "gateway",
  messages: [
    {
      role: "user",
      content: "Hello"
    }
  ]
});

console.log(result.choices[0].message.content);
```

Embeddings:

```typescript
const result = await client.embeddings.create({
  model: "gateway",
  input: "Hello world"
});
```

Este es uno de los principales criterios de diseño.

---

# 33. Testing

Crear tests para al menos:

### Authentication

```text
sin token → 401
token incorrecto → 401
token correcto → permitido
```

### Chat validation

```text
messages vacío → 400
role inválido → 400
stream true → 400
```

### Embeddings validation

```text
input vacío → 400
string válida → permitido
array válida → permitido
```

### Routing

```text
provider 1 funciona → no llamar provider 2
provider 1 responde 429 → llamar provider 2
provider 1 responde 500 → llamar provider 2
provider 1 responde 400 → no fallback
todos fallan → devolver provider_error
```

Mockear los requests HTTP.

Los tests no deben llamar APIs reales.

---

# 34. Configuración inicial

Crear `models.json` con soporte para:

### Chat

```text
Groq
OpenRouter
Gemini
```

### Embeddings

```text
Gemini
```

No asumir que un modelo determinado permanecerá gratuito indefinidamente.

Por ese motivo el modelo debe ser exclusivamente configuración.

---

# 35. Regla sobre modelos gratuitos

La disponibilidad gratuita cambia con el tiempo.

Por eso:

```text
NO hardcodear un modelo en el código
```

El modelo concreto debe estar únicamente en:

```text
config/models.json
```

Cambiar:

```json
"model": "old-model"
```

por:

```json
"model": "new-model"
```

debe ser suficiente para cambiarlo.

---

# 36. Configuración propuesta definitiva

Conceptualmente:

```json
{
  "chat": {
    "strategy": "priority",
    "providers": [
      {
        "id": "groq",
        "type": "openai-compatible",
        "baseUrl": "https://api.groq.com/openai/v1",
        "apiKeyEnv": "GROQ_API_KEY",
        "model": "CHOOSE_CURRENT_FREE_MODEL",
        "enabled": true,
        "priority": 1
      },
      {
        "id": "openrouter",
        "type": "openai-compatible",
        "baseUrl": "https://openrouter.ai/api/v1",
        "apiKeyEnv": "OPENROUTER_API_KEY",
        "model": "CHOOSE_CURRENT_FREE_MODEL",
        "enabled": true,
        "priority": 2
      }
    ]
  },

  "embeddings": {
    "strategy": "priority",
    "providers": [
      {
        "id": "gemini",
        "type": "gemini",
        "apiKeyEnv": "GEMINI_API_KEY",
        "model": "gemini-embedding-001",
        "enabled": true,
        "priority": 1
      }
    ]
  }
}
```

Codex debe verificar en la documentación actual qué modelos gratuitos están disponibles en el momento de implementar el proyecto y configurar una opción razonable.

La arquitectura no debe depender de esos nombres.

---

# 37. No implementar

Para evitar sobre-ingeniería, explícitamente NO implementar inicialmente:

- base de datos;
- panel administrativo;
- gestión de usuarios;
- login;
- OAuth;
- JWT;
- billing;
- métricas persistentes;
- Redis;
- queues;
- workers;
- caching;
- semantic cache;
- observability externa;
- tracing distribuido;
- rate limiting persistente;
- streaming;
- WebSockets;
- model benchmarking automático;
- selección de modelo mediante IA;
- balanceo inteligente;
- circuit breakers sofisticados;
- dashboards;
- SDK propio.

---

# 38. Criterio de éxito

El proyecto está terminado cuando se puede hacer:

```text
Nuestra app
    │
    ▼
POST /v1/chat/completions
    │
    ▼
AI Gateway
    │
    ▼
Proveedor gratuito
```

sin que nuestra aplicación conozca:

```text
proveedor
modelo
credenciales
routing
```

y también:

```text
Nuestra app
    │
    ▼
POST /v1/embeddings
    │
    ▼
AI Gateway
    │
    ▼
Embedding vector
```

---

# 39. Criterios de aceptación

Antes de considerar terminado el proyecto:

- `npm install` funciona;
- `npm run dev` funciona;
- `npm run build` funciona;
- los tests pasan;
- `/health` responde;
- `/v1/chat/completions` funciona;
- `/v1/embeddings` funciona;
- requests sin API key son rechazados;
- se puede cambiar de modelo mediante `models.json`;
- fallback funciona;
- ningún secret está versionado;
- README explica instalación y deployment;
- la página `/` documenta el API;
- funciona desplegado en Vercel;
- el OpenAI JavaScript SDK puede consumir ambos endpoints usando `model: "gateway"`.

---

# 40. Prioridad de implementación

Implementar en este orden:

```text
1. scaffold Next.js
2. configuración
3. autenticación
4. schemas
5. provider abstraction
6. OpenAI-compatible provider
7. Gemini embeddings provider
8. routing/fallback
9. /v1/chat/completions
10. /v1/embeddings
11. error normalization
12. tests
13. documentación
14. página /
15. verificar build
```

No añadir funcionalidad adicional antes de completar estos puntos.

---

# 41. Filosofía del proyecto

Priorizar siempre:

```text
simple
↓
entendible
↓
configurable
↓
intercambiable
↓
fácil de desplegar
```

sobre:

```text
genérico
↓
abstracto
↓
enterprise
↓
sobre-ingenierizado
```

Si existe una decisión entre una implementación simple que cubre estos requisitos y una arquitectura más sofisticada pensando en posibilidades futuras, elegir la implementación simple.

Construir únicamente lo que necesitamos ahora.
