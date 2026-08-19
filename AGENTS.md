# Guía de trabajo para agentes

## Fuente de verdad

- Leer `docs/SPEC.md` completamente antes de realizar cambios funcionales o arquitectónicos.
- `docs/SPEC.md` define el alcance, las restricciones y los criterios de aceptación. No modificarla para justificar decisiones de implementación.
- Mantener `README.md` y la documentación de `/` coherentes con el comportamiento real.
- Si una limitación técnica impide cumplir literalmente la especificación, elegir la alternativa más simple que preserve su intención y documentar la desviación.

## Objetivo del proyecto

Este repositorio implementa un AI Gateway interno y desplegable en Vercel. Expone una interfaz OpenAI-like estable para chat y embeddings y oculta a los consumidores:

- proveedor y modelo reales;
- credenciales de proveedores;
- selección por prioridad;
- fallback entre proveedores.

La interfaz pública reconoce solamente el modelo lógico `gateway` (y `default` como alias de entrada). Nunca debe revelar modelos internos.

## Stack y límites

- Next.js App Router con Route Handlers y runtime Node.js.
- TypeScript estricto, `fetch` nativo, Zod y Vitest.
- Sin base de datos, Express, Redis, colas, workers ni infraestructura adicional.
- No agregar streaming, tool calling, multimodalidad, rate limiting persistente, panel administrativo ni otras funciones fuera del MVP.
- Priorizar implementaciones pequeñas, claras y mantenibles. Evitar capas y abstracciones especulativas.

## API pública

- `GET /health`: público; responde únicamente `{ "status": "ok" }`.
- `POST /v1/chat/completions`: requiere Bearer API key; no soporta streaming.
- `POST /v1/embeddings`: requiere Bearer API key; acepta un string o una lista de strings.
- Todas las respuestas de `/v1/*` deben incluir `X-Request-Id`.
- Las respuestas y errores deben mantener el formato OpenAI-like documentado en la especificación.

## Arquitectura actual

- `app/`: rutas públicas y página de documentación.
- `lib/handlers.ts`: flujo HTTP compartido, autenticación, validación y normalización pública.
- `lib/config.ts`: validación de `config/models.json` y resolución de variables de entorno.
- `lib/routing.ts`: orden por prioridad y fallback.
- `lib/providers/`: contratos y adaptadores OpenAI-compatible/Gemini.
- `lib/schemas/`: schemas Zod de las solicitudes públicas.
- `tests/`: pruebas de comportamiento con HTTP de proveedores mockeado.

Mantener esta estructura simple. `OpenAICompatibleProvider` debe seguir sirviendo a Groq, OpenRouter y futuros proveedores compatibles mediante configuración, no mediante lógica específica.

## Configuración y proveedores

- Toda selección de proveedores, prioridad, endpoints y nombres de modelos vive en `config/models.json`.
- No hardcodear modelos en TypeScript ni permitir que el `model` público elija el modelo real.
- Las credenciales viven exclusivamente en variables de entorno referenciadas mediante `apiKeyEnv`.
- Providers iniciales: Groq, OpenRouter y Gemini para chat; Gemini para embeddings.
- La disponibilidad y los free tiers cambian: consultar documentación oficial actual antes de cambiar modelos o endpoints.
- Un provider habilitado debe tener configurada su variable de entorno. Para omitirlo, marcarlo como deshabilitado en configuración.

## Routing y errores

- Estrategia única: `priority` ascendente.
- Hacer fallback solamente ante 408, 429, 5xx, timeout o error de red.
- No hacer fallback ante errores de cliente 4xx, excepto 408/429.
- Tratar 401/403 de un proveedor como configuración interna incorrecta.
- No devolver cuerpos de error crudos, IDs, nombres de modelos ni detalles internos del proveedor.
- Mantener los códigos públicos normalizados definidos en `lib/errors.ts` y `docs/SPEC.md`.

## Seguridad

- Nunca versionar API keys ni archivos `.env`/`.env.local`.
- `.env.example` solo contiene nombres y valores vacíos o seguros.
- Nunca loguear Authorization, API keys, prompts completos, embeddings ni contenido privado.
- Los logs admitidos contienen solamente request ID, endpoint, provider ID, duración, estado y uso de fallback.
- Mantener el límite máximo de request en 1 MB y timeout con `AbortController`.
- No abrir CORS con `Access-Control-Allow-Origin: *`.
- Antes de publicar, revisar el diff y buscar secrets accidentales.

## Calidad y verificación

- Todo cambio funcional debe incluir pruebas de comportamiento observable y fallos relevantes.
- Los tests nunca llaman APIs externas reales; mockear `fetch`.
- Mantener cobertura para autenticación, validación, prioridad, fallback, ausencia de fallback en errores de cliente, normalización, embeddings simples/múltiples, configuración inválida y sanitización.
- Antes de considerar terminado cualquier cambio, ejecutar:

```bash
npm install
npm test
npm run build
```

- Si se modifican dependencias, ejecutar también `npm audit` y no aceptar vulnerabilidades altas conocidas cuando exista una actualización compatible.
- Para cambios en rutas, verificar cuando sea razonable `/health`, `/` y el endpoint afectado en desarrollo local.

## Git y GitHub

- Repositorio remoto: `https://github.com/sarreche/boio-ai-gateway` (privado).
- Trabajar con la identidad de GitHub autenticada de `sarreche`; nunca guardar tokens o credenciales en el repositorio.
- Inspeccionar `git status`, rama, remoto y diff antes de agregar archivos.
- No incluir cambios ajenos o artefactos generados (`node_modules`, `.next`, logs o entornos locales).
- Nunca implementar ni publicar cambios directamente sobre `main`.
- Antes de modificar código, crear una rama enfocada desde `main`. Usar nombres claros como `feat/<descripcion>`, `fix/<descripcion>`, `docs/<descripcion>` o `chore/<descripcion>`.
- Todos los cambios deben llegar a `main` mediante Pull Request. No hacer merge sin indicación explícita del usuario.
- Usar Conventional Commits con el tipo apropiado, por ejemplo: `feat: add provider fallback`, `fix: sanitize provider errors`, `docs: clarify deployment setup`, `test: cover timeout fallback`, `refactor: simplify routing` o `chore: update dependencies`.
- Mantener commits breves, enfocados y correctamente tipados. No usar mensajes genéricos.
- Ejecutar tests y build antes de hacer push.
- Abrir los PR como draft salvo que el usuario pida explícitamente que estén listos para revisión.
- Todo PR debe estar bien documentado e incluir como mínimo:
  - qué cambió y por qué;
  - alcance y decisiones relevantes;
  - impacto para consumidores, configuración o deployment;
  - pruebas y comandos de validación ejecutados;
  - configuración manual o variables de entorno pendientes;
  - desviaciones respecto de `docs/SPEC.md`, o indicar explícitamente que no existen.
- Revisar el diff completo y el estado de checks antes de pedir revisión.
- No reescribir historial compartido ni usar operaciones destructivas sin autorización explícita.

## Documentación de entrega

Al finalizar, resumir:

- comportamiento implementado;
- archivos principales modificados;
- tests y build ejecutados;
- configuración manual pendiente;
- cualquier desviación respecto de `docs/SPEC.md`.
