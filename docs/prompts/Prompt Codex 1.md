Lee completamente `docs/SPEC.md` antes de realizar cualquier cambio.

`docs/SPEC.md` es la fuente de verdad de la implementación. Respeta sus decisiones, alcance, restricciones y criterios de aceptación.

El `README.md` ya referencia la especificación y debe mantenerse coherente con la implementación final.

Implementa el proyecto descrito en `docs/SPEC.md`.

## Reglas de trabajo

- Prioriza simplicidad, claridad y mantenibilidad.
- No sobre-ingenierices.
- No agregues funcionalidades fuera del alcance definido en `docs/SPEC.md`.
- No introduzcas infraestructura, dependencias o abstracciones que no sean necesarias.
- No hardcodees modelos, API keys ni configuración que la especificación indique que debe ser configurable.
- Mantén la interfaz pública independiente de los proveedores y modelos reales.
- Respeta la compatibilidad OpenAI-like definida en la especificación.
- Mantén el proyecto compatible con deployment en Vercel.
- Usa TypeScript de forma estricta y evita `any` salvo que sea realmente inevitable.

## Importante sobre la especificación

No modifiques `docs/SPEC.md` para hacer que coincida con decisiones tomadas durante la implementación.

No uses cambios en la especificación para justificar shortcuts.

Si encontrás una contradicción, una limitación real de Vercel, del runtime o de algún proveedor que impida cumplir exactamente algún punto:

1. elegí la alternativa más simple que preserve la intención original;
2. implementala;
3. documentá claramente la desviación y su motivo en el resumen final.

## Forma de implementación

Antes de escribir código:

1. inspeccioná la estructura actual del repositorio;
2. leé `docs/SPEC.md` completo;
3. revisá `package.json` y cualquier código existente;
4. determiná qué partes ya existen y cuáles deben implementarse;
5. evitá reemplazar código correcto sin necesidad.

Después implementá incrementalmente:

1. estructura base del proyecto;
2. configuración;
3. autenticación;
4. schemas y validación;
5. abstracción mínima de providers;
6. provider OpenAI-compatible;
7. soporte necesario para Gemini;
8. routing y fallback;
9. `/health`;
10. `/v1/chat/completions`;
11. `/v1/embeddings`;
12. normalización de errores;
13. logging y request IDs;
14. tests;
15. documentación de la página raíz;
16. README;
17. verificación completa.

## Tests

Los tests son parte obligatoria del entregable.

Todo comportamiento funcional nuevo debe quedar cubierto por tests automatizados razonables.

No consideres una funcionalidad terminada hasta que sus tests correspondientes estén implementados y pasando.

Prioriza tests de comportamiento observable y casos de fallo relevantes.

No escribas tests que simplemente repliquen la implementación interna.

Los tests deben quedar versionados en el repositorio y no deben llamar APIs externas reales.

Mockeá las dependencias HTTP de los proveedores.

Además de lo definido en `docs/SPEC.md`, verificá especialmente:

- autenticación válida e inválida;
- validación de requests;
- routing por prioridad;
- fallback ante 429, 5xx, timeout y network errors;
- ausencia de fallback para errores de cliente;
- normalización de respuestas;
- normalización de errores;
- embeddings simples y múltiples;
- configuración inválida;
- ausencia de secrets en respuestas y logs.

## Proveedores y modelos

Consultá la documentación oficial actual de los proveedores necesarios para verificar:

- endpoints;
- formatos;
- modelos disponibles;
- compatibilidad OpenAI;
- modelos gratuitos o free tiers actualmente disponibles.

No dependas arquitectónicamente de que un modelo concreto siga siendo gratuito.

Los nombres concretos de modelos deben permanecer exclusivamente en la configuración definida por el proyecto.

No hardcodees modelos en la lógica.

## Seguridad

Revisá especialmente que:

- ninguna API key quede versionada;
- `.env` y `.env.local` estén ignorados;
- `.env.example` no contenga secrets reales;
- no se logueen prompts completos;
- no se logueen tokens de autorización;
- no se expongan nombres de modelos internos;
- no se devuelvan errores crudos de proveedores;
- el endpoint público no revele configuración interna.

## Documentación

Mantén el `README.md` simple y útil.

Debe conservar la referencia:

```md
See [docs/SPEC.md](docs/SPEC.md) for the complete project specification.
```

Además debe incluir como mínimo:

- propósito del proyecto;
- requisitos;
- instalación;
- configuración de variables de entorno;
- ejecución local;
- tests;
- build;
- deployment en Vercel.

La página `/` debe documentar el uso del API según `docs/SPEC.md`.

No agregues herramientas externas de documentación.

## Verificación final

Antes de terminar, ejecutá realmente:

```bash
npm install
npm test
npm run build
```

y cualquier comando adicional estrictamente necesario para validar el proyecto.

Si algo falla, corregilo y repetí la verificación.

No des por terminado el trabajo mientras existan errores de build o tests fallando que sean responsabilidad de esta implementación.

## Criterio de finalización

El trabajo solo está terminado cuando:

- el proyecto implementa `docs/SPEC.md`;
- `/health` funciona;
- `/v1/chat/completions` funciona;
- `/v1/embeddings` funciona;
- la autenticación funciona;
- la configuración de providers/modelos está desacoplada del código;
- el fallback funciona;
- los tests están implementados y pasan;
- `npm run build` pasa;
- no hay secrets versionados;
- la documentación está actualizada;
- el proyecto está listo para desplegar en Vercel.

## Al finalizar

Entregá un resumen corto indicando:

1. qué implementaste;
2. qué archivos principales agregaste o modificaste;
3. qué providers quedaron configurados;
4. qué tests existen;
5. resultado de `npm test`;
6. resultado de `npm run build`;
7. cualquier desviación respecto a `docs/SPEC.md`;
8. cualquier configuración manual que todavía deba hacer yo, por ejemplo variables de entorno o API keys.

No agregues nuevas features ni mejoras opcionales después de que los criterios anteriores estén cumplidos.