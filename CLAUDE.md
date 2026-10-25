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

## Estado resumido (detalle en `docs/ESTADO.md`)
- Producción: web https://proyecto-w-phi.vercel.app (Vercel) · API https://sintonia-api-7763.onrender.com (Render Free, duerme tras 15 min) · BD Neon (Postgres + pgvector). Repo https://github.com/joseortega-hub/proyecto-w (`main`; cada push despliega).
- Hecho: MVP, embeddings + pgvector, filtro de idioma, 4 temáticas (música/Jamendo, videojuegos/RAWG, películas/TMDB, libros/Open Library), "Mi YouTube" (OAuth, importación con IA, guardar lista, reproductor IFrame), perfil de gustos, contexto automático, texto o voz inicial, intención explícita (anclas + búsqueda en directo + "por qué" de una línea), selector de 7 temas (tokens DTCG), servidor MCP y despliegue.
- IA: siguiente pregunta `DECISION_CHAIN=groq,laya,gemini` (+ Cerebras y OpenRouter si hay clave, detrás de Groq); perfil y encaje con Gemini; texto `TEXT_CHAIN=groq,gemini` (+ los mismos respaldos); embeddings Gemini (1000/día). Jev implementado pero sin crédito. El plan gratuito de Gemini se agota a menudo: hay respaldos sin IA.
- Pendiente del usuario en Render: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `TMDB_API_KEY`, `RAWG_API_KEY`, `JAMENDO_CLIENT_ID`, `OPEN_LIBRARY_CONTACT` y, como respaldo gratuito de IA, `CEREBRAS_API_KEY` y `OPENROUTER_API_KEY` (también en `.env`).
- Pendiente técnico: `pnpm embed` + `pnpm sync-embeddings` cuando Gemini tenga cupo; repartir el tope de importación de YouTube entre fuentes.
- "Mi carpeta" (24/10/2026, básica): carpeta local con ID3 + IA + MusicBrainz, revisión a mano y reproducción desde el dispositivo. "Datos frikis" (24/10/2026): créditos de las APIs en la lista y la ficha (`items.details`, MusicBrainz al abrir la ficha; relleno con `pnpm details`). Detalle y siguientes pasos en `docs/ESTADO.md`.
- "Bajo el capó" (24/10/2026): `/bajo-el-capo` con trazas de IA (proveedor, respaldos, latencia, coste), modo demo en vivo, comparativa de proveedores y juez bajo demanda; solo metadatos. Detalle en `docs/ESTADO.md`.
- Entrevista guiada por candidatas (24/10/2026): "esto es lo que he entendido" (1 llamada), bolsa de ~150 candidatas, pregunta por ganancia de información, "Quedan ~N" y lista dentro de la bolsa. Detalle en `docs/ESTADO.md`.
- "Crea tu tema con IA" (24/10/2026): el menú 🎨 genera temas desde una descripción (Groq → Gemini), con contraste AA garantizado (motor compartido `packages/tokens/theme-engine.mjs`) y hasta 3 guardados en el dispositivo. Detalle en `docs/ESTADO.md`.
- "Tu vibra" (24/10/2026): el perfil de ánimo pasa a ser un nombre con personalidad + degradado OKLCH AA + barras por temática que se arrastran y reordenan la lista dentro de la bolsa sin IA (`POST /sessions/:id/vibe`), con origen de cada dimensión y compartir como imagen. Detalle en `docs/ESTADO.md`.
- Auditoría responsive (24/10/2026): sin desbordes en 320–1440; arreglado safe areas (notch/PWA), móvil en horizontal (variante `short`), zonas táctiles de 44 px (variante `touch`) y "Tu vibra" que ya no se mueve al hacer scroll (pulsación larga o «Ajustar»). Informe en `docs/auditoria-responsive.md`, script en `apps/web/scripts/audit-responsive.js`.
- "Hoy para ti" + "Tu historia" (24/10/2026): la main `/` es ahora saludo con degradado por hora y tiempo + barra universal (`POST /api/route-intent`, gancho vacío `lib/secret-phrases.ts` para el Modo Perreo) + combo de esta noche sin IA + tarjetas con "Continuar"; `/historia` tiene calendario de vibras, top, lo aprendido y la IA en números. Detalle en `docs/ESTADO.md`.
- **En cola (24/10/2026)**: cuando terminen "Refuerzo de la entrevista" y "Auditoría responsive", lanzar con Sonnet la main **"Hoy para ti"** (saludo con contexto y degradado, barra universal "¿Qué te apetece?" que detecta la temática con IA y lleva a ella, "combo de esta noche" que cruza temáticas, tarjetas de temáticas con "Continuar") y el panel **"Tu historia"** (calendario de vibras, tu top, lo aprendido de 👍/👎, la IA en números con enlace a Bajo el capó). Las disposiciones "Desliza" quedan para después del lunes.
- **En cola, después de "Hoy para ti"**: **"Modo Perreo"**, una temática secreta que se activa al escribir en la barra universal una de las frases homenaje a los artistas favoritos del usuario (sin distinguir mayúsculas ni tildes): "el matatán" → Wisin, "el capitán" → Yandel, "la octava maravilla" → Arcángel, "los menores" → Farruko, "la voz favorita bby" → Jay Wheeler. Cada frase desbloquea el modo (animación + tema neón) con un homenaje a ese artista: portada con su foto, biografía y su apodo, y una primera lista con sus canciones y parecidos dentro de los 66. Las frases no se muestran en ningún sitio: se comparan con un hash en el cliente para que no se vean en el código. Datos: los 66 artistas de UrbanoPedia, proyecto anterior del usuario, en el contenedor Docker `urbanopedia-postgres-1` (BD `urbanpedia`, tabla `artists`: biografía, origen, años, enlaces de Spotify/YouTube Music/Apple Music, popularidad y oyentes; `labels` + `artists_label_history`: 92 sellos), con fotos en `C:\Users\Jfort\Downloads\Artistas\*.jpg` (263) y `UrbanoPedia/media`. No tiene canciones: sacarlas de los canales de YouTube Music de cada artista (`playlistItems` del canal de subidas, 1 unidad por página), de "Mi YouTube" del usuario y de Last.fm (`artist.getTopTracks`, parecidos entre los 66). IA (Groq) para atributos y estilos (perreo, romántico, trap, dembow, old school). Privado por persona (`owner_id`), como "Mi YouTube"; los datos no van al repositorio público.
  - Modo Perreo incluye un **explorador de artistas**: galería con fotos y filtros combinables por fama (deslizador de "underground" a "mainstream" con la popularidad o los oyentes de Spotify de UrbanoPedia, y los oyentes de Last.fm para el resto), país y ciudad de origen (con chips de bandera y, si da tiempo, un mapa), época o años en activo, sello y estilo (perreo, romántico, trap, dembow, old school). Ordenar por fama, antigüedad o nombre. Cada artista abre su ficha (biografía, sellos, enlaces, canciones y parecidos) con un botón "Hazme una lista con este artista", que lanza la entrevista con él como ancla. Ampliable con los seguidos de Instagram (exportación oficial `following.json` del usuario + Wikidata P2003), si queda margen.
- "Modo Perreo" (24/10/2026): temática secreta (frases por hash en el cliente, tema neón, 66 artistas con fotos, explorador con filtros, ficha y primera lista). Datos con `pnpm perreo:import` + `pnpm perreo:load [--prod]`. Detalle en `docs/ESTADO.md`.
- Instagram en el Modo Perreo (24/10/2026): 399 artistas (los 66 + 333 de Instagram, 381 que sigues) con segunda pasada MusicBrainz/Last.fm, 66 cuentas "por revisar" (`/perreo/por-revisar`), insignia, filtro "Solo los que sigo" y "También sigues a…". Ahora por lotes de 300 con tipos (artista, productor, sello…): `pnpm perreo:instagram --batch N`, `pnpm perreo:instagram:import --batch N`, `pnpm perreo:load [--prod]`; lotes 1 y 2 listos (una canción por artista). Detalle en `docs/ESTADO.md`.
- Nombres propios por palabras (25/10/2026): «libros de la autora saran j maas», «películas del director nolan», «juegos de nintendo», «la saga zelda» se detectan con patrones, se resuelven con erratas contra el catálogo o la fuente en directo y son filtro duro antes de la IA; chip «de Sarah J. Maas». Detalle en `docs/ESTADO.md`.
- Refuerzo de la entrevista (24/10/2026): la IA elige entre entidades reales del catálogo (productora, colección, saga, autor, título, género), filtros duros, semillas primero, banco de preguntas a mano y `pnpm eval` con proveedores reales. Detalle en `docs/ESTADO.md`.
- Fuentes extra (24/10/2026): Wikidata (obras de sagas), Last.fm/ListenBrainz (artistas parecidos), TMDB (similares) y Google Books (edición en español) confirman y amplían lo que entiende la IA, con caché en BD (`source_cache`); `pnpm eval` incluye sus comprobaciones. Detalle en `docs/ESTADO.md`.
- **Orden de la cola tras el refuerzo básico (24/10/2026, tarde)**: 1) sesión "entrevista conversacional + parecidos" (respuesta libre con 🎤 en cada pregunta, "Vale: más romántico" con deshacer; "parecido a X" con propuestas del LLM confirmadas contra el catálogo o la API; la base ya existe: entidades only/include/like, `coverageGap`, búsqueda en directo) en paralelo con 2) la main "Hoy para ti" + "Tu historia"; 3) Modo Perreo; 4) fuentes extra (Wikidata, TMDB similares, Last.fm, ListenBrainz, Google Books; claves ya en `.env` y Render), si queda cupo. Pendiente del usuario: `pnpm facets --prod` y luego `pnpm eval --prod`.
  - Instagram: el usuario ya dejó su exportación oficial en `data/privado/following.json` (ignorado por Git; 1074 cuentas seguidas, entradas con `title` y `string_list_data`). Usar solo los nombres de usuario, resolver artistas con Wikidata (P2003 = usuario de Instagram) y descartar el resto. Nunca subir ese archivo ni los usuarios que no sean artistas.
- Listas editables y aleatorio (25/10/2026): el lápiz del resultado permite reordenar (asa ⠿, pulsación larga en móvil, ↑ ↓), quitar con deshacer y añadir desde la biblioteca (`PUT /api/sessions/:id/entries`); 🔀 y 🔁 en el reproductor global. Detalle en `docs/ESTADO.md`.
- Tamaño de lista elegible (25/10/2026): deslizador mín.–máx. (5–50, por defecto 10–20) por temática; `GET /sessions/:id/tune?min=&max=`. Detalle en `docs/ESTADO.md`.
