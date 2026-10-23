# Proyecto X (nombre temporal)

Proyecto escaparate para demostrar dominio de herramientas de IA modernas. Objetivo: tenerlo listo para el lunes 26/10/2026.

## La idea
Motor genérico "un catálogo que te entiende":
1. **Catálogo**: elementos cargados en BD (primer dominio: música con seed de Jamendo).
2. **Entrevista adaptativa**: preguntas de sí/no estilo Akinator; cada pregunta depende de las respuestas anteriores.
3. **Resultado**: perfil de ánimo estructurado → búsqueda semántica → lista personalizada con explicación de cada elección.

Debe ser **multidominio**: cada dominio (música, películas…) = adaptador de importación + configuración (atributos, estilo de preguntas). El motor es común.

## Stack decidido
- Frontend: React + TypeScript (Vite), **diseño atómico** (atoms → molecules → organisms → templates → pages) + Storybook. PWA para usarlo desde el móvil.
- Backend: Node 24 LTS + NestJS, APIs REST. Monorepo con pnpm.
- BD: PostgreSQL + pgvector.
- IA:
  - **Jev (TypeSafe AI)** para decisiones: `choice` (siguiente pregunta), `score` (perfil de ánimo), `noul` (¿encaja esta canción?). SDK `@typesafe-ai/sdk`. Jev NO genera texto.
  - **Gemini** (plan gratuito) para generar texto: preguntas y explicaciones.
  - Todo detrás de interfaces (`DecisionProvider`, `TextProvider`, `EmbeddingProvider`) con fallback a Gemini si Jev no está disponible.
  - Vercel AI SDK, embeddings, servidor MCP propio, Langfuse para observabilidad.
- Datos: Jamendo (música), TMDB (películas, fase posterior).
- Despliegue gratuito: Vercel (front) + Render/Neon/Supabase (back + Postgres). Docker en local.

## Fases
0. Diseño: wireframes y mapa de pantallas (aprobar antes de programar).
1. MVP: seed Jamendo → entrevista → lista → reproductor.
2. Embeddings + pgvector + explicaciones.
3. Segundo dominio (películas).
4. Extras: MCP, Langfuse, despliegue, tests.

Cada fase se trabaja en una conversación nueva. Al terminar una fase, actualizar la sección "Estado" de abajo.

## Reglas de trabajo
- El usuario habla español: responder siempre en español.
- Al usuario le encantan el reguetón y el género urbano: en el chat, háblale con un tono cercano y con flow urbano (por ejemplo "dale", "bro", "fuego 🔥", "en la movie"), con respeto y sin caricaturas. Lo técnico tiene que seguir quedando claro. Los commits, el código y la documentación se escriben con tono normal.
- Plan Pro con límites: si algo se atasca (mismo error 2-3 veces, reintentos en bucle, tarea que crece sin avanzar), **parar y avisar** con lo que pasa y opciones, en vez de seguir gastando.
- Priorizar herramientas gratuitas.
- Git: el usuario usará su propio repositorio cuando la idea esté cerrada.

## Estado
- Entorno: Node 24.22.1, npm 11, pnpm 10, Docker 27, Git 2.45, Python 3.12.
- Repo: https://github.com/joseortega-hub/proyecto-w (rama `main`).
- Configuración: `.env.example` (en Git) → el usuario rellena `.env` (ignorado). Nunca pedir ni mostrar claves en el chat. Las claves de Gemini y Jamendo ya están en `.env`.
- Jev: cuenta creada pero sin crédito, así que todavía no hay API key. El proveedor está implementado (`@typesafe-ai/sdk`, con Gemini de respaldo si falla); mientras tanto `DECISION_PROVIDER=gemini`. El usuario añadirá ~5 € más adelante.
- Gemini (comprobado el 23/10/2026): `gemini-2.5-flash` y `gemini-2.5-flash-lite` ya no están disponibles para cuentas nuevas, y `gemini-3.8-flash` se cuelga en el plan gratuito. Se usa `GEMINI_MODEL=gemini-3.1-flash-lite` (2-6 s por llamada; unos 20 s la primera, en frío). Embeddings: `gemini-embedding-001` a 768 dimensiones.
- Fase 0 (diseño) aprobada el 23/10/2026: ver `docs/diseno.md`. Nombre provisional: **Sintonía**. Lienzo: https://claude.ai/artifact/Uzikzt5ig9T1h8cx9wPFNE (fuente en `docs/design/canvas/`).
- La cuenta no tiene design systems; se puede crear uno de "Sintonía" a partir de los tokens.
- **Fase 1 (MVP) terminada el 23/10/2026.** Ver `README.md` para la arquitectura y los comandos.
  - Monorepo pnpm: `apps/api` (NestJS 12 en ESM, Drizzle, AI SDK v7), `apps/web` (React 19, Vite 8, PWA, Tailwind v4 + shadcn/ui, Storybook 10) y `packages/tokens` (tokens DTCG + `gen-tokens.mjs` → `theme.css`; `pnpm tokens`).
  - Puertos: Postgres en 5434 y API en 3001, porque 5432 y 3000 los ocupan otros proyectos Docker del usuario. Web en 5173, con proxy de `/api`.
  - Esquema genérico: `domains`, `domain_attributes`, `items` (con columna `embedding vector(768)` aún vacía) e `interview_sessions`. Migraciones en `apps/api/drizzle/`.
  - Seed: `pnpm seed` importa unas 800 canciones de Jamendo. Con `tags`, Jamendo a veces devuelve 0 resultados, así que se reintenta con `fuzzytags`. Además, `include=stats` vacía la respuesta, así que no se usa.
  - Las decisiones con Gemini usan `experimental_decide` del AI SDK v7 (`google.decisionModel`). El SDK también trae `typeSafeAi.decisionModel('jev-latest')` en `@ai-sdk/typesafe-ai`: es una alternativa para Jev.
  - Para no sumar dos esperas por pregunta, la decisión y la redacción de las preguntas candidatas van en paralelo.
  - Verificado en local: entrevista completa con Gemini, Afinando por SSE, lista con explicaciones y reproducción de audio en móvil y escritorio. Tests del motor: `pnpm test`.
  - Limitaciones conocidas:
    - El % de encaje sale poco disperso (≈ 69-75 %).
    - Biblioteca y Ficha son marcadores de posición.
    - La navegación lateral es propia, no el Sidebar de shadcn.
    - Los tipos de la API están duplicados en `apps/web/src/lib/api.ts`.
    - `nest start --watch` tarda unos 30 s en arrancar.
- Siguiente: Fase 2 (embeddings + pgvector + explicaciones).
