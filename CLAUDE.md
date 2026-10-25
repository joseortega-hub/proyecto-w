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

## Reglas de trabajo
- El usuario habla español: responder siempre en español.
- Al usuario le encantan el reguetón y el género urbano: en el chat, háblale con un tono cercano y con flow urbano (por ejemplo "dale", "bro", "fuego 🔥", "en la movie"), con respeto y sin caricaturas. Lo técnico tiene que seguir quedando claro. Los commits, el código y la documentación se escriben con tono normal.
- Plan Pro con límites: si algo se atasca (mismo error 2-3 veces, reintentos en bucle, tarea que crece sin avanzar), **parar y avisar** con lo que pasa y opciones, en vez de seguir gastando.
- **Gastar poco**: este archivo es corto a propósito. El detalle técnico está en `docs/ESTADO.md` y en `README.md`: busca la sección que necesites (`grep`) en vez de leerlos enteros. Lee solo los archivos de código que vayas a tocar. Pruebas: tests y typecheck siempre; en el navegador, solo el flujo que cambia, con pocas capturas. Sin investigaciones web largas salvo que hagan falta.
- Al terminar una tarea: añade su detalle a `docs/ESTADO.md` (en su sección) y, aquí, como mucho una línea en "Estado resumido". No hagas crecer este archivo.
- Nunca pedir ni mostrar claves en el chat. Configuración: `.env.example` (en Git) → `.env` (ignorado). En producción, las variables van en los paneles de Render y Vercel.
- Priorizar herramientas gratuitas.
- **Tono de los textos del producto** (interfaz, preguntas de la entrevista, avisos, "por qué"): punto intermedio, cercano pero cuidado, como Spotify o Netflix en español. Tuteo sí; jerga, coloquialismos y frases de colegas no ("te pongo", "dale", "bro", "flipar", "mola", "a tope"). Ni formal ni de banco. Ejemplo: no "Dime cómo estás y te pongo lo que encaja", sino "Cuéntanos cómo te sientes y te recomendamos lo que mejor encaja". El flow urbano es solo para el chat con el usuario y para el Modo Perreo.

## Estado resumido (25/10/2026; detalle técnico de cada parte en `docs/ESTADO.md`)
- **Para quien llegue nuevo**: este archivo es el traspaso completo. El proyecto se coordinó con muchas sesiones en paralelo; todo lo hecho está en `main` y documentado en `docs/ESTADO.md` (busca la sección con grep). Guía técnica para la entrevista: https://claude.ai/artifact/LsLHYQSkGToQMeiJfkCfPx ("Sintonía por dentro"). Demo: lunes 26/10/2026, desde el móvil, contra producción.
- **Producción**: web https://proyecto-w-phi.vercel.app (Vercel) · API https://sintonia-api-7763.onrender.com (Render Free, duerme tras 15 min: abrirla 1 min antes de la demo) · BD Neon (Postgres + pgvector). Repo https://github.com/joseortega-hub/proyecto-w (`main`; cada push despliega).
- **Hecho y en `main`**: MVP y búsqueda semántica (pgvector); 4 temáticas públicas (música/Jamendo, videojuegos/RAWG, películas/TMDB, libros/Open Library) + "Mi YouTube" (OAuth, importación con IA, guardar lista, reproductor) + "Mi carpeta" (archivos locales); entrevista guiada por candidatas (ganancia de información, "Quedan ~N", "esto es lo que he entendido", respuesta libre con texto o 🎤, "parecido a X"); comprensión contra el catálogo real con filtros duros, nombres propios por palabras con erratas y fuentes extra (Wikidata, Last.fm, ListenBrainz, TMDB similares, Google Books); perfil de gustos con 👍/👎; contexto automático; "Tu vibra"; listas editables, aleatorio y tamaño mín.–máx.; datos frikis; main "Hoy para ti" (barra universal) y "Tu historia"; 7 temas + "Crea tu tema con IA"; "Bajo el capó" (trazas, comparativa, juez); caché de respuestas de IA; servidor MCP; Modo Perreo secreto (~400 artistas de UrbanoPedia e Instagram, explorador, revisión); tono de textos revisado; auditoría responsive; `pnpm eval` con casos reales.
- **IA**: siguiente pregunta `DECISION_CHAIN` (Groq → Laya → Gemini, + OpenRouter/Cerebras si hay clave); perfil y encaje con Gemini; texto Groq → Gemini; embeddings Gemini (1000/día); caché `AI_CACHE=on`. Jev implementado sin crédito. Los planes gratuitos se agotan con las pruebas: **no lanzar evals ni pruebas masivas contra producción antes de la demo.**
- **Sesiones que estaban terminando al hacer este traspaso**: "Caché de IA, Laya en Hugging Face y OpenRouter" (Laya listo en `deploy/laya-space/`; falta que el usuario cree el Space y ponga `LAYA_BASE_URL` + `LAYA_API_KEY` en Render) y "Modo Perreo: editar artistas y repaso móvil". Comprueba con `git log` y `docs/ESTADO.md` si quedaron terminadas.
- **Pendiente del usuario (comandos desde su PC, en `C:\Proyecto X`)**: `pnpm perreo:load --prod` (Modo Perreo con lotes 1-2 de Instagram, revisiones y fotos), `pnpm facets --prod` (productoras, sagas e idioma real en producción), opcional `pnpm embed` + `pnpm sync-embeddings` cuando Gemini tenga cupo. Variables de Render: comprobar que estén Google (OAuth), TMDB, RAWG, Jamendo, Open Library, Last.fm, Google Books, OpenRouter y, si se crea el Space, las de Laya. Lote 3 de Instagram sin lanzar (`pnpm perreo:instagram --batch 3` + `perreo:instagram:import --batch 3` + `perreo:load --prod`).
- "Para saber más" (25/10/2026): enlaces reales de Wikidata, verificados y cacheados (`GET /api/links`), en el resultado y en la ficha. Detalle en `docs/ESTADO.md`.
- **Después del lunes**: embeddings locales para quitar el límite diario; "catálogo que crece con el uso" más amplio; análisis real del audio con Essentia.js en "Mi carpeta"; dominios generados por IA.
- Editar artistas del Modo Perreo (25/10/2026): «Editar» en la ficha (hoja inferior), `PATCH /api/perreo/artists/:slug`, `manual_fields` que `perreo:load` no pisa (migración 0018) y repaso CSS móvil (filtros en hoja, nav sin solapes). Detalle en `docs/ESTADO.md`.
- Entender frases (25/10/2026): temáticas con palabras clave reales, actores, lo pedido se suma (Y), palabras comunes no son sagas, preguntas según lo concreto (0-1 si basta), «parecido a Marvel» arreglado. Detalle en `docs/ESTADO.md`.
- «Desliza» (25/10/2026): en el resultado, interruptor Lista/Desliza con tarjetas (derecha 👍 a la lista, izquierda 👎 fuera, arriba ficha, deshacer), View Transitions y más parecidas al acabarse. Detalle en `docs/ESTADO.md`.
