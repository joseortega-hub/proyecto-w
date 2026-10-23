# Sintonía

*Un catálogo que te entiende.* Unas pocas preguntas de sí o no, al estilo Akinator, y una lista hecha a tu medida en la que cada elección viene con su explicación. El motor es genérico: el primer dominio es música (catálogo libre de [Jamendo](https://www.jamendo.com)).

## Cómo funciona

1. **Entrevista adaptativa.** En cada turno, un `DecisionProvider` elige qué preguntar a continuación (o si ya puede terminar) entre las "sondas" que define el dominio. Al mismo tiempo, un `TextProvider` redacta las candidatas, así que la espera es la de una sola llamada. La entrevista dura entre 4 y 10 preguntas y se corta cuando la confianza del perfil es suficiente.
2. **Afinando.** El perfil de ánimo se calcula con decisiones `score` (una por atributo) y `noul` (una por grupo de estilos). Después:
   - **Búsqueda híbrida.** El perfil se convierte en un texto de consulta con el mismo vocabulario que los elementos ("tranquila", "instrumental", "jazz, clásica y lounge"), se calcula su embedding y pgvector trae los vecinos más cercanos por similitud coseno (índice HNSW, siempre filtrando por dominio). Esa bolsa se une a los mejores por atributos y se ordena combinando ambos parecidos en percentiles. Si no hay embeddings, se usa solo el parecido por atributos.
   - **Encaje.** El `DecisionProvider` comprueba si encaja cada candidata (`noul`). El % mostrado (40-99) combina esa probabilidad con la relevancia relativa dentro de la lista.
   - **Explicaciones.** Gemini escribe el porqué de cada elemento a partir de sus coincidencias con el perfil. Si se salta alguno, se le vuelve a pedir; si aun así falta, se usa una explicación de respaldo, así que ningún elemento se queda sin porqué.
   - La pantalla muestra estos pasos en directo mediante Server-Sent Events.
3. **Resultado y reproductor.** La lista lleva el % de encaje y la explicación de cada canción, ajustes rápidos ("+ energía", "con voz") que relanzan la búsqueda sin repetir la entrevista, un reproductor global con mini-reproductor y la Media Session API para la pantalla de bloqueo.

## Estructura

```
apps/
  api/   NestJS 12 (REST + SSE), Drizzle ORM, AI SDK v7
  web/   React 19 + Vite 8, PWA, Tailwind CSS v4 + shadcn/ui, Storybook 10
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
- **Multidominio** (`apps/api/src/domains`): un dominio es un adaptador de importación (`CatalogAdapter`) más una configuración con atributos, grupos de estilos, sondas y ajustes. El motor (`interview.engine.ts`) no sabe qué es una canción.
- **Rutas por dominio** (`apps/web/src/lib/domain.ts`): biblioteca, listas, entrevistas y resultados cuelgan de `/:domain/` (por ahora solo `/music`), y las listas guardadas en el dispositivo van separadas por dominio.
- **Diseño atómico** (`apps/web/src/components`):
  - `ui/` es el código generado por shadcn.
  - `atoms/` y `molecules/` lo envuelven con las variantes de Sintonía y tienen historias de Storybook.
  - `organisms/` y `templates/` reciben datos por props.
  - `pages/` conectan rutas, datos (TanStack Query) y estado.

## Puesta en marcha

Requisitos: Node 24, pnpm 10 y Docker.

```bash
cp .env.example .env        # y rellena GEMINI_API_KEY, GROQ_API_KEY y JAMENDO_CLIENT_ID
pnpm install
docker compose up -d        # PostgreSQL 17 + pgvector en el puerto 5434
docker compose --profile laya up -d   # opcional: Ollaya con Laya en 127.0.0.1:11435
docker exec ollaya ollaya pull laya:multilingual   # solo la primera vez
pnpm db:migrate
pnpm seed                   # ~800 canciones de Jamendo
pnpm embed                  # embeddings del catálogo (reanudable; --all recalcula todos)
pnpm classify               # idioma de las pistas que Jamendo no trae (reanudable)
pnpm dev                    # API en :3001 y web en http://localhost:5173
```

`GET /api/items/:id/similar?limit=10` devuelve los elementos más parecidos por embedding (para la futura Ficha).

**Preferencias previas.** Cada dominio puede declarar filtros duros que se eligen antes de la entrevista (en música, el idioma de la letra: español, inglés o me da igual). Se guardan en `items.facets`, filtran la búsqueda (SQL y pgvector) y, si dejan pocos elementos, el resultado lo avisa. Las instrumentales pasan siempre el filtro de idioma. El texto inicial de la persona solo se guarda mientras dura la entrevista.

Otros comandos: `pnpm storybook` (en :6006), `pnpm test` (pruebas del motor), `pnpm typecheck` y `pnpm tokens`.

## Datos y licencias

La música viene de Jamendo con licencias Creative Commons; el reproductor enlaza cada pista con su página original.
