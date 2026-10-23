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
- Configuración: `.env.example` (en Git) → el usuario rellena `.env` (ignorado). Nunca pedir ni mostrar claves en el chat.
- Jev: cuenta creada pero sin crédito, así que todavía no hay API key. Se implementa igualmente; mientras tanto `DECISION_PROVIDER=gemini`. El usuario añadirá ~5 € más adelante.
- Comprobar en la Fase 1 que `GEMINI_MODEL` sigue siendo un modelo vigente del plan gratuito.
- Pendiente del usuario: API keys de Gemini y Jamendo en `.env`.
- Fase 0 (diseño) aprobada el 23/10/2026: ver `docs/diseno.md`. Nombre provisional: **Sintonía**. Lienzo: https://claude.ai/artifact/Uzikzt5ig9T1h8cx9wPFNE (fuente en `docs/design/canvas/`).
- UI: shadcn/ui + Radix + Tailwind CSS v4 dentro del diseño atómico. Tokens W3C DTCG en `docs/design/tokens.json`, con `theme.css` generado por `docs/design/gen-tokens.mjs`. En la Fase 1, mover los tokens y el script a un paquete del monorepo.
- La cuenta no tiene design systems; se puede crear uno de "Sintonía" a partir de los tokens.
- Siguiente: Fase 1 (MVP).
