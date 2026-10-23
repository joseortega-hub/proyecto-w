# Sintonía

*Un catálogo que te entiende.* Unas pocas preguntas de sí o no, al estilo Akinator, y una lista hecha a tu medida en la que cada elección viene con su explicación. El motor es genérico y sirve a cuatro temáticas:

| Temática | Fuente | Elementos (seed por defecto) | Preferencia previa |
|---|---|---|---|
| Música | [Jamendo](https://www.jamendo.com) (Creative Commons) | ~800 canciones, con reproductor | Idioma de la letra |
| Videojuegos | [RAWG](https://rawg.io) | ~400 juegos | Plataforma (PC, PlayStation, Xbox, Nintendo, móvil) |
| Películas | [TMDB](https://www.themoviedb.org) | ~325 películas | Idioma original |
| Libros | [Open Library](https://openlibrary.org) | ~250 libros | Idioma con edición |

## Cómo funciona

1. **Entrevista adaptativa.** En cada turno, un `DecisionProvider` elige qué preguntar a continuación (o si ya puede terminar) entre las "sondas" que define el dominio. Al mismo tiempo, un `TextProvider` redacta las candidatas, así que la espera es la de una sola llamada. La entrevista dura entre 4 y 10 preguntas y se corta cuando la confianza del perfil es suficiente.
2. **Afinando.** El perfil de ánimo se calcula con decisiones `score` (una por atributo) y `noul` (una por grupo de estilos). Después:
   - **Búsqueda híbrida.** El perfil se convierte en un texto de consulta con el mismo vocabulario que los elementos ("tranquila", "instrumental", "jazz, clásica y lounge"), se calcula su embedding y pgvector trae los vecinos más cercanos por similitud coseno (índice HNSW, siempre filtrando por dominio). Esa bolsa se une a los mejores por atributos y se ordena combinando ambos parecidos en percentiles. Si no hay embeddings, se usa solo el parecido por atributos.
   - **Encaje.** El `DecisionProvider` comprueba si encaja cada candidata (`noul`). El % mostrado (40-99) combina esa probabilidad con la relevancia relativa dentro de la lista.
   - **Explicaciones.** El `TextProvider` escribe el porqué de cada elemento a partir de sus coincidencias con el perfil. El prompt describe el carácter con palabras ("enérgica", "con voz"), nunca con las cifras internas, y una explicación que cite cifras de 0 a 1 o porcentajes cuenta como no escrita. Si falta alguna, se vuelve a pedir; si aun así falta, se usa una explicación de respaldo, así que ningún elemento se queda sin porqué.
   - La pantalla muestra estos pasos en directo mediante Server-Sent Events.
3. **Resultado.** La lista lleva el % de encaje y la explicación de cada elemento y ajustes rápidos ("+ energía", "+ historia", "más corto") que relanzan la búsqueda sin repetir la entrevista. En música hay un reproductor global con mini-reproductor y la Media Session API para la pantalla de bloqueo; en el resto de temáticas cada elemento abre su ficha, que enlaza a la fuente con su atribución.

## Estructura

```
apps/
  api/   NestJS 12 (REST + SSE), Drizzle ORM, AI SDK v7
  web/   React 19 + Vite 8, PWA, Tailwind CSS v4 + shadcn/ui, Storybook 10
  mcp/   Servidor MCP (stdio) para usar Sintonía desde Claude
packages/
  tokens/  Tokens W3C DTCG → theme.css para Tailwind (pnpm tokens)
docs/      Diseño aprobado de la Fase 0 (docs/diseno.md) y fuente del lienzo
```

- **IA detrás de interfaces** (`apps/api/src/ai`): `DecisionProvider` (choice, score y noul, las primitivas de Jev), `TextProvider` y `EmbeddingProvider`. Cada tarea usa una cadena de respaldo (`provider-chain.ts`): responde el primer proveedor disponible, y el que se cae, se satura o se queda sin cupo queda apartado unos minutos.

  | Tarea | Cadena por defecto | Variable |
  |---|---|---|
  | Siguiente pregunta (`choice`) | Groq → Laya (local) → Gemini | `DECISION_CHAIN` |
  | Perfil (`score`) y % de encaje (`noul`) | Gemini (o Jev → Gemini) | `DECISION_PROVIDER` |
  | Texto (explicaciones, redacción en vivo) | Groq → Gemini | `TEXT_CHAIN` |
  | Embeddings | Gemini | — |

  - **Gemini**: `experimental_decide` del AI SDK con `google.decisionModel()`.
  - **Jev** (`@typesafe-ai/sdk`): con `DECISION_PROVIDER=jev`; también puede entrar en `DECISION_CHAIN`.
  - **Laya** con Ollaya en local (`ghcr.io/ollaya-dev/ollaya`): habla el protocolo de Jev, así que reutiliza `JevDecisionProvider` con otra `baseURL` (sin compresión zstd, que Ollaya no admite). Al arrancar, la API lo precalienta con `keep_alive: -1` para dejarlo residente; mientras carga, o si no está (producción), se salta sin esperar. No se usa para `noul`: con preguntas vagas ("¿encaja esta canción?") da probabilidades poco fiables.
  - **Groq** (`@ai-sdk/groq`): no da logprobs, así que en `choice` usa salida estructurada con una probabilidad que declara el propio modelo. **No está calibrada**: sirve para elegir la opción, no para fiarse de su confianza. Decisiones con `openai/gpt-oss-120b` y texto con `qwen/qwen3.8-27b`: modelos distintos para no compartir el cupo (~8K tokens/min por modelo), y cada uno es el respaldo del otro.
  - Los logs registran qué proveedor respondió cada decisión y cuánto tardó (`[Decisiones] decisión choice → groq:openai/gpt-oss-120b en 480 ms`).
- **Multidominio** (`apps/api/src/domains`): un dominio es un adaptador de importación (`CatalogAdapter`, en `apps/api/src/catalog`) más una configuración (`*.domain.ts`) con atributos de escala, grupos de géneros, sondas, ajustes, preferencias previas, género gramatical y verbo ("esta canción" / "este videojuego", "escuchar" / "jugar") y la fuente con su atribución. El motor (`interview.engine.ts`) no sabe qué es una canción.
  - Cada adaptador traduce los datos de su fuente a atributos 0-1 con reglas sencillas y probadas (`catalog.spec.ts`): géneros y etiquetas de RAWG más el tiempo de juego; géneros, palabras clave, año y duración de TMDB; temas, páginas y año de Open Library.
  - Las facetas (`items.facets`) admiten uno o varios valores (`language: 'es'`, `platforms: ['pc', 'nintendo']`); el filtro usa `?|` de JSONB.
- **Rutas por dominio** (`apps/web/src/lib/domain.ts`): `/` es el selector de temáticas; biblioteca, ficha (`/:domain/biblioteca/:id`), listas, entrevistas y resultados cuelgan de `/:domain/`. Cada temática tiene icono y color propios (`[data-domain]` en `index.css`, utilidades `bg-domain`, `text-domain`, `bg-domain-soft`) y se cambia con pestañas (cabecera en móvil, barra lateral en escritorio). Las listas guardadas en el dispositivo van separadas por dominio.
- **Diseño atómico** (`apps/web/src/components`):
  - `ui/` es el código generado por shadcn.
  - `atoms/` y `molecules/` lo envuelven con las variantes de Sintonía y tienen historias de Storybook.
  - `organisms/` y `templates/` reciben datos por props.
  - `pages/` conectan rutas, datos (TanStack Query) y estado.

## Puesta en marcha

Requisitos: Node 24, pnpm 10 y Docker.

```bash
cp .env.example .env        # y rellena GEMINI_API_KEY, GROQ_API_KEY, JAMENDO_CLIENT_ID, RAWG_API_KEY y TMDB_API_KEY
pnpm install
docker compose up -d        # PostgreSQL 17 + pgvector en el puerto 5434
docker compose --profile laya up -d   # opcional: Ollaya con Laya en 127.0.0.1:11435
docker exec ollaya ollaya pull laya:multilingual   # solo la primera vez
pnpm db:migrate
pnpm seed                   # todos los dominios; o uno: pnpm seed games (también movies, books, music)
pnpm embed                  # embeddings del catálogo (reanudable; pnpm embed games; --all recalcula)
pnpm questions              # banco de preguntas (la API también lo completa al arrancar)
pnpm classify               # idioma de las pistas que Jamendo no trae (reanudable)
pnpm dev                    # API en :3001 y web en http://localhost:5173
```

Endpoints del catálogo: `GET /api/domains/:id/items?q=&tags=&offset=&limit=` (biblioteca), `GET /api/items/:id` (ficha) y `GET /api/items/:id/similar?limit=10` (parecidos por embedding).

**Cupos gratuitos.** Los embeddings de Gemini admiten 1000 textos al día por modelo: con los cuatro catálogos (~1800 elementos) hacen falta dos días. `pnpm embed` lo detecta, se para y dice cuándo volver a lanzarlo; lo que ya se guardó se conserva. Sin embedding, la búsqueda tira de los atributos.

**Gustos, contexto y punto de partida.**
- *Mis gustos* (por temática): lo que te gusta y lo que no, marcado con chips o contado con tus palabras (la IA lo traduce a etiquetas del catálogo). Los 👍/👎 de cada lista ajustan un peso por etiqueta. Los gustos no filtran: suben la puntuación de lo que encaja (`similarity` y `hybridRank`) y la entrevista deja de preguntar por estilos. Sin registro: va ligado a un id anónimo del navegador (`x-sintonia-user`). Endpoints: `GET/PUT/DELETE /api/taste/:domain`, `POST /api/taste/:domain/feedback` y `POST /api/taste/:domain/interpret`.
- *Contexto automático*: hora, día de la semana y tiempo actual de [Open-Meteo](https://open-meteo.com) (sin clave) viajan como dato en el `state` de cada decisión. Sin permiso de ubicación previo, se usa la posición de `CONTEXT_LATITUDE`/`CONTEXT_LONGITUDE`.
- *Punto de partida*: antes de las preguntas puedes escribir o dictar (Web Speech API; el 🎤 se oculta si el navegador no la tiene) cómo estás. Lo que deje claro no se pregunta. No se guarda ni el texto ni el audio.

**Preferencias previas.** Cada dominio puede declarar filtros duros que se eligen antes de la entrevista (en música, el idioma de la letra: español, inglés o me da igual). Se guardan en `items.facets`, filtran la búsqueda (SQL y pgvector) y, si dejan pocos elementos, el resultado lo avisa. Las instrumentales pasan siempre el filtro de idioma. El texto inicial de la persona solo se guarda mientras dura la entrevista.

**Sintonía dentro de Claude (MCP).** `apps/mcp` es un servidor MCP con el SDK oficial que reutiliza la API REST: temáticas, biblioteca, ficha, "Mis gustos" y listas a partir de una petición en texto ("hazme una lista para el gimnasio"), con % de encaje y explicaciones. La petición es el punto de partida de la entrevista y cada pregunta restante se responde a partir de ella (`POST /api/sessions/:id/auto-answer`, o "no lo sé" si no lo dice). También se puede jugar la entrevista de sí/no dentro del chat. Cómo conectarlo a Claude Desktop y guion de la demo: [`apps/mcp/README.md`](apps/mcp/README.md).

Otros comandos: `pnpm storybook` (en :6006), `pnpm test` (pruebas del motor), `pnpm typecheck` y `pnpm tokens`.

## Despliegue (gratuito)

Producción: **https://proyecto-w-phi.vercel.app** (web) → **https://sintonia-api-7763.onrender.com/api** (API).

| Pieza | Servicio | Configuración |
|---|---|---|
| Web (PWA) | Vercel, Root Directory `apps/web` | [`apps/web/vercel.json`](apps/web/vercel.json) |
| API | Render, plan Free, Frankfurt | [`render.yaml`](render.yaml) (Blueprint) |
| BD | Neon, Postgres 17 + pgvector 0.8.0, AWS Frankfurt | volcado de la BD local |

- **Un solo origen.** La web llama siempre a `/api` y Vercel lo redirige a Render (`rewrites` en `vercel.json`), igual que el proxy de Vite en local. Así no hace falta CORS y el `EventSource` de Afinando (SSE) funciona tal cual: Vercel transmite los eventos en directo. El resto de rutas va a `index.html` (SPA) y `sw.js` no se cachea, para que las actualizaciones de la PWA lleguen.
- **API en Render.** Build: `pnpm install --frozen-lockfile --prod=false` y `nest build`. Arranque: `node apps/api/dist/db/migrate.js && node apps/api/dist/main.js`, así que las migraciones nuevas se aplican solas en cada despliegue. Comprobación de salud: `/api/domains`. Solo se redespliega si cambia `apps/api` o el lockfile (`buildFilter`).
  - Variables fijas en `render.yaml`: `DECISION_CHAIN=groq,gemini` (sin Laya, que es local), `TEXT_CHAIN=groq,gemini` y `DECISION_PROVIDER=gemini`.
  - Secretos que se rellenan en el panel de Render: `DATABASE_URL` (la cadena directa de Neon, sin `-pooler`), `GROQ_API_KEY`, `GEMINI_API_KEY` y `WEB_URL`. Las claves de los catálogos no hacen falta en producción: solo las usa `pnpm seed`.
  - Arranque en frío: el plan gratuito duerme el servicio tras 15 minutos sin tráfico y despertarlo tarda unos 30-60 s. Al arrancar, la API carga el banco de preguntas (ya completo en la BD, no redacta nada) y calienta la primera pregunta de cada temática: 4 decisiones de Groq.
- **Base de datos.** Se cargó con un volcado de la local (sin sesiones ni gustos), para no repetir los seeds ni gastar cupo de embeddings:

  ```bash
  docker exec sintonia-db pg_dump -U proyecto -d proyecto -Fc --no-owner --no-acl \
    --exclude-table-data=interview_sessions --exclude-table-data=taste_profiles -f /tmp/sintonia.dump
  docker exec -e PGURL="<cadena de Neon>" sintonia-db sh -c 'psql "$PGURL" -c "create extension if not exists vector" && pg_restore --no-owner --no-acl -d "$PGURL" /tmp/sintonia.dump'
  ```

  Neon ofrece pgvector 0.8.0, que ya incluye `hnsw.iterative_scan`.
- **Embeddings nuevos.** `pnpm embed` se lanza en local y después `pnpm sync-embeddings` copia a producción los que allí falten (con `--all`, todos). Lee `PROD_DATABASE_URL` del `.env`. Así el cupo diario de Gemini se gasta una sola vez.

## Datos y licencias

- **Música**: Jamendo, con licencias Creative Commons; el reproductor enlaza cada pista con su página original.
- **Videojuegos**: [RAWG API](https://rawg.io/apidocs), clave gratuita para proyectos personales con atribución y enlace a RAWG en cada página que muestra sus datos (biblioteca, ficha y resultado lo llevan).
- **Películas**: [TMDB API](https://developer.themoviedb.org), clave gratuita de desarrollador para uso no comercial. *This product uses the TMDB API but is not endorsed or certified by TMDB.*
- **Libros**: [Open Library](https://openlibrary.org/developers/api), sin clave. Las peticiones se identifican con un User-Agent (límite de 1 petición/s, o 3/s con un contacto en `OPEN_LIBRARY_CONTACT`).
