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
- Datos: Jamendo (música); en la Fase 3, TMDB (películas), Open Library (libros) y RAWG o IGDB (videojuegos).
- Despliegue gratuito: Vercel (front) + Render/Neon/Supabase (back + Postgres). Docker en local.

## Fases
0. Diseño: wireframes y mapa de pantallas (aprobar antes de programar).
1. MVP: seed Jamendo → entrevista → lista → reproductor.
2. Embeddings + pgvector + explicaciones.
3. Más dominios: **películas** (TMDB, clave gratuita), **libros** (Open Library, sin clave) y **videojuegos** (RAWG con clave gratuita, uso no comercial y atribución obligatoria; alternativa: IGDB con cuenta de Twitch). Comprobar las condiciones de cada API al implementarla.
   - En la app, cada temática va **bien separada**: biblioteca, listas y entrevistas por dominio (selector o pestañas por dominio, con icono y color propios). Todo el modelo de datos lleva `domain` (elementos, listas, sesiones de entrevista, perfiles).
4. Extras: MCP, Langfuse, despliegue, tests.
   - **Conectar YouTube Music** (nuevo adaptador `YouTubeAdapter`): inicio de sesión OAuth con Google → importar las listas del usuario y sus vídeos con "Me gusta" (solo `videoCategoryId=10`, Música) → crear la lista generada en su cuenta → reproducirla dentro de la app con el reproductor IFrame de YouTube.
     - YouTube Data API v3 gratuita, sin necesidad de Premium. Cuota: 10 000 unidades/día; `playlistItems.insert` cuesta 50 (≈ 9 listas de 20 canciones al día). No usar `search.list` (100 unidades): importar desde las listas del usuario.
     - App OAuth en modo de pruebas: el usuario se añade como usuario de prueba; los refresh tokens caducan a los 7 días.
     - Comprobar si la lista "Me gusta" de YouTube Music (`LM`) es accesible con la API oficial. No usar `ytmusicapi` ni otras librerías no oficiales (incumplen los términos de uso).
     - Spotify descartado: desde feb. 2026 exige Premium al dueño de la app y limita a 5 usuarios de prueba.

## Ideas extra
### Prioridad para el finde (demo del lunes)
- **% de encaje visible**: cada elemento de la lista muestra su probabilidad de encaje (`noul` de Jev, o el equivalente de Gemini) y una explicación breve de por qué se eligió. IA explicable.
- **Contexto automático**: añadir al `state` de la entrevista la hora, el día de la semana y el tiempo actual (Open-Meteo, gratis y sin API key) para que las preguntas y la lista se adapten sin preguntar más.
- **Punto de partida por texto o voz** (opcional, justo después del MVP): antes de la entrevista, el usuario puede escribir o decir cómo está o qué le apetece. Jev `score` (o Gemini) lo convierte en un perfil inicial con confianza por dimensión, y la entrevista solo pregunta por las dimensiones con poca confianza. Botón para saltarlo e ir directo a las preguntas.
  - Voz: Web Speech API del navegador (Chrome, Edge y Chrome Android; parcial en Safari iOS; Firefox no). Si no está disponible, ocultar el botón 🎤. Más adelante, plan B: enviar el audio a Gemini.
  - Privacidad: no guardar el texto ni el audio, solo el perfil resultante. El texto del usuario es dato, nunca instrucciones para el modelo (protección contra prompt injection).
- **Perfil de gustos por usuario** (sesión nueva cuando termine la Fase 2; incluye la antigua idea "Aprende de ti"): separar los **gustos** (largo plazo, por dominio) del **estado de ánimo** (cada entrevista).
  - Onboarding la primera vez en cada dominio: chips de géneros/etiquetas sacados del catálogo + texto libre ("me encantan Pokémon, Marvel y los juegos de mundo abierto") que Gemini normaliza a etiquetas del catálogo. También lo que no le gusta. Pantalla "Mis gustos" para editarlo o borrarlo.
  - Guardar por dominio: etiquetas favoritas, etiquetas descartadas e idioma preferido (así el filtro de idioma ya viene marcado).
  - Uso: el perfil va como dato en el `state` (la entrevista pregunta solo por el estado, no por los gustos) y en la búsqueda **sube la puntuación** de lo que encaja con los gustos sin excluir el resto (margen para descubrir).
  - Aprendizaje: 👍/👎 por elemento que ajusta el perfil.
  - Para el lunes, sin registro: perfil anónimo ligado a un id guardado en el navegador. Más adelante, inicio de sesión real.
  - Ojo: Jamendo casi no tiene género urbano (reguetón, trap, dembow…). En la demo, lucirlo con videojuegos (RAWG) o, cuando exista, con la biblioteca propia de YouTube Music.
- **Sintonía dentro de Claude (MCP)**: servidor MCP que expone el catálogo y la generación de listas, preparado como demo en directo desde Claude Desktop ("hazme una lista para el gimnasio").

### Cuando haya crédito en Jev
- **Panel Jev frente a Gemini**: lanzar la misma decisión a los dos proveedores y comparar latencia, coste y resultado. Apoyarse en Langfuse para las trazas.

### Ideas futuras
- **Portada generada con IA** para cada lista (comprobar primero si hay plan gratuito de generación de imágenes).
- **Modo fiesta**: varias personas responden desde su móvil y se genera una lista de consenso.
- **DJ con voz**: locución generada por IA entre canciones.
- **Evals automáticos**: comprobar la calidad de las preguntas y las listas con un LLM como juez.
- **CI con revisión por IA**: GitHub Actions con tests y revisión de pull requests con Claude.
- **Más dominios**: series (TMDB), anime (AniList, sin clave), podcasts (Podcast Index), recetas (TheMealDB), cócteles (TheCocktailDB), arte (The Met / Art Institute of Chicago, sin clave), ejercicio (wger, sin clave).
- **Dominios generados por IA**: a partir de la URL de una API, Gemini genera la configuración del dominio (atributos, estilo de preguntas, mapeo de datos) y el usuario la revisa y aprueba.

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
- Gemini (comprobado el 23/10/2026): `gemini-2.5-flash` y `gemini-2.5-flash-lite` ya no están disponibles para cuentas nuevas, y `gemini-3.8-flash` se cuelga en el plan gratuito. Decisiones con `GEMINI_MODEL=gemini-3.1-flash-lite` y texto con `GEMINI_TEXT_MODEL=gemini-3.5-flash-lite`: van separados porque cada modelo gratuito tiene su propio cupo de 15 peticiones/min. Embeddings: `gemini-embedding-001` a 768 dimensiones. Si un modelo está saturado (503 "high demand"), sin cuota o no responde en 12 s, se pasa a `GEMINI_FALLBACK_MODELS` (por defecto `gemini-3.5-flash`) y, como último recurso, al principal de la otra tarea; el modelo que falla queda apartado 3 minutos (cortacircuitos). Si fallan todos al explicar, la lista se guarda sin explicaciones.
- Fase 0 (diseño) aprobada el 23/10/2026: ver `docs/diseno.md`. Nombre provisional: **Sintonía**. Lienzo: https://claude.ai/artifact/Uzikzt5ig9T1h8cx9wPFNE (fuente en `docs/design/canvas/`).
- La cuenta no tiene design systems; se puede crear uno de "Sintonía" a partir de los tokens.
- **Fase 1 (MVP) terminada el 23/10/2026.** Ver `README.md` para la arquitectura y los comandos.
  - Monorepo pnpm: `apps/api` (NestJS 12 en ESM, Drizzle, AI SDK v7), `apps/web` (React 19, Vite 8, PWA, Tailwind v4 + shadcn/ui, Storybook 10) y `packages/tokens` (tokens DTCG + `gen-tokens.mjs` → `theme.css`; `pnpm tokens`).
  - Puertos: Postgres en 5434 y API en 3001, porque 5432 y 3000 los ocupan otros proyectos Docker del usuario. Web en 5173, con proxy de `/api`.
  - Esquema genérico: `domains`, `domain_attributes`, `items` (con columna `embedding vector(768)` aún vacía) e `interview_sessions`. Migraciones en `apps/api/drizzle/`.
  - Seed: `pnpm seed` importa unas 800 canciones de Jamendo. Con `tags`, Jamendo a veces devuelve 0 resultados, así que se reintenta con `fuzzytags`. Además, `include=stats` vacía la respuesta, así que no se usa.
  - Las decisiones con Gemini usan `experimental_decide` del AI SDK v7 (`google.decisionModel`). El SDK también trae `typeSafeAi.decisionModel('jev-latest')` en `@ai-sdk/typesafe-ai`: es una alternativa para Jev.
  - Verificado en local: entrevista completa con Gemini, Afinando por SSE, lista con explicaciones y reproducción de audio en móvil y escritorio. Tests del motor: `pnpm test`.
  - Preparado para las "Ideas extra": cada elemento guarda `fit` (probabilidad de encaje del DecisionProvider), `POST /api/sessions` acepta `initialText` opcional, la sesión tiene `context` (vacío hasta conectar Open-Meteo, ver `interview.context.ts`) y el perfil incluye `confidence` por dimensión. El texto y el contexto viajan siempre en el `state`, nunca en las instrucciones.
  - Separación por dominio lista para la Fase 3: los elementos y las sesiones (con su perfil) llevan `domain_id`; los atributos de cada elemento van en JSONB (`items.attributes`) y su definición en `domain_attributes` y `domains.config`. En la web, todas las rutas cuelgan de `/:domain/` (`/music`, `/music/entrevista`, `/music/listas`, `/music/biblioteca`, `/music/resultado/:id`); `/` redirige a `/music` hasta que haya selector de dominio. Las listas guardadas llevan `domainId` y los textos ("canciones") salen de la configuración del dominio. El reproductor es global.
  - Limitaciones conocidas:
    - Biblioteca y Ficha son marcadores de posición.
    - La navegación lateral es propia, no el Sidebar de shadcn.
    - Los tipos de la API están duplicados en `apps/web/src/lib/api.ts`.
    - `nest start --watch` tarda unos 30 s en arrancar.
- **Entrevista más rápida y sin repeticiones (23/10/2026, commits 9f0d88e, 98c1cf0 y 1d82aee).**
  - Repeticiones: eran de sentido, no de pregunta. `askableProbes` descarta las sondas cuyas dimensiones ya están resueltas y `assertNotAsked` bloquea en el servidor las ya hechas. Las respuestas llevan `step` y el guardado comprueba que la sesión no cambió (409 ante dobles envíos).
  - Banco de preguntas pregenerado (tabla `question_bank`, `pnpm questions`; la API completa lo que falte al arrancar): 3 variantes por sonda y dominio. El DecisionProvider solo elige la sonda y se toma la variante que menos palabras repite: una sola llamada por pregunta. Sin banco, se redacta en vivo como respaldo.
  - Precarga de la siguiente pregunta para "sí" y "no" mientras se lee la actual (`INTERVIEW_PREFETCH=false` la desactiva) y primera pregunta cacheada por dominio.
  - Medido (6 s de lectura por pregunta, Gemini gratis saturado): primera pregunta 0,1-1,6 s; con la precarga a tiempo, 27-42 ms; si no llega a tiempo, la espera es la de la decisión (1-5 s con Gemini sano, hasta 20 s saturado; con Jev debería bajar de 1 s). Antes del banco, la redacción en vivo añadía 1-20 s por pregunta.
- **Fase 2 (embeddings + pgvector + explicaciones) terminada el 23/10/2026.**
  - `pnpm embed` calcula los embeddings del catálogo con `gemini-embedding-001` (768 dimensiones) y los guarda en `items.embedding`. Se puede reanudar (solo procesa los que faltan; `--all` los recalcula) y va en lotes de 50 con pausas.
    - El plan gratuito cuenta cada texto del lote como una petición (≈ 100 por minuto), así que el script limita a 80 textos por minuto y reintenta si recibe un 429. Las 803 canciones tardan unos 10 minutos.
    - El texto de cada elemento (`itemEmbeddingText` en `interview.engine.ts`) pone los atributos en palabras ("tranquila", "instrumental"), igual que la consulta del perfil (`profileQueryText`), para que los dos textos usen el mismo vocabulario.
  - Índice HNSW (`vector_cosine_ops`) en la migración `0002_embedding_hnsw`. Las consultas filtran siempre por `domain_id` y usan `hnsw.iterative_scan = relaxed_order` (pgvector 0.8).
  - Afinando:
    - Calcula el embedding de la consulta (purpose `query`) y pide a pgvector 120 vecinos, a los que suma los mejores por atributos.
    - `hybridRank` combina los dos parecidos en percentiles, a partes iguales.
    - Si falla el embedding, ordena solo por atributos; si falla el `noul` de un lote, ese lote se queda sin `fit`.
  - % de encaje (`matchPercent`, 40-99): combina la probabilidad `noul` con la relevancia relativa entre los 16 evaluados. Ejemplo verificado: 71-97 % (antes, 57-93 % con la misma entrevista).
  - Explicaciones: el prompt incluye las coincidencias de cada elemento con el perfil (`matchHints`). Si el modelo se salta alguna, se vuelve a pedir solo por las que faltan; si aun así falta, se usa `fallbackReason`. Ningún elemento se queda sin explicación.
  - `GET /api/items/:id/similar?limit=10` devuelve los vecinos por embedding del mismo dominio, para la futura Ficha (`api.getSimilar` en la web).
  - Verificado en local: Afinando sobre una entrevista real da una lista coherente con el perfil y con todas las explicaciones, y la pantalla de resultado la muestra bien.
  - Ojo: el plan gratuito de `gemini-3.1-flash-lite` admite 15 peticiones por minuto, y cada Afinando hace 3 (2 de `noul` y 1 de explicaciones) más la entrevista.
  - Pendiente: los ajustes rápidos mueven poco la consulta semántica, porque el resumen de respuestas no cambia con ellos.
  - **Filtro de idioma** (preferencias previas, genéricas por dominio):
    - `DomainConfig.preferences` define filtros duros que se eligen antes de la entrevista. En música: idioma de la letra (`es`, `en`, `any`). Los valores de cada elemento van en `items.facets` (JSONB, migración `0003_preferences_facets`), no en `attributes`, que son escalas 0-1.
    - Datos: Jamendo da el idioma en `musicinfo.lang` (vacío si no lo sabe) y la letra con `include=lyrics`. El adaptador guarda `language: es | en | other | instrumental`. Las pistas con voz sin idioma se clasifican una sola vez con `choice` por lotes de 8 (durante `pnpm seed`, usando un trozo de la letra, o con `pnpm classify`, que se puede reanudar). La letra no se guarda.
    - Catálogo (23/10/2026): 81 en español, 328 en inglés, 297 instrumentales, 77 en otros idiomas y 20 aún sin clasificar porque se agotó la cuota (`pnpm classify` las completa).
    - El filtro va en la búsqueda (SQL del catálogo y de pgvector), no después. Las instrumentales pasan siempre. Si quedan pocas en el idioma elegido, el resultado lo dice (`notice`, p. ej. "En español solo tengo 3 canciones que encajen, así que te completo la lista con instrumentales").
    - Web: botones "Español · Inglés · Me da igual" en Inicio, guardados en el dispositivo por dominio (`lib/preferences.ts`). Afinando los aplica a la sesión (`PUT /api/sessions/:id/preferences`) antes de buscar.
    - Preselección: si hay texto inicial, `PreferencesService` deduce con `choice` las preferencias no elegidas, con su confianza. `POST /api/domains/:id/preferences/guess` lo hace sin guardar nada, para cuando exista el campo de texto en la web.
  - **Privacidad del texto inicial**: se borra (`initial_text = null`) al calcular el perfil y al guardar la lista. `SessionCleanupService` lo borra cada hora en las sesiones con perfil y en las abandonadas (24 h sin cambios).
  - Verificado en local: con "Español" la bolsa baja de 803 a ~380 candidatas y sale el aviso en la pantalla de resultado. La limpieza dejó a cero las sesiones con texto inicial.
- Siguiente: Fase 3 (más dominios) o las "Ideas extra" de prioridad para el finde.
