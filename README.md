# Sintonía

*Un catálogo que te entiende.* Unas pocas preguntas de sí o no, al estilo Akinator, y una lista hecha a tu medida en la que cada elección viene con su explicación. El motor es genérico: el primer dominio es música (catálogo libre de [Jamendo](https://www.jamendo.com)).

## Cómo funciona

1. **Entrevista adaptativa.** En cada turno, un `DecisionProvider` elige qué preguntar a continuación (o si ya puede terminar) entre las "sondas" que define el dominio. Al mismo tiempo, un `TextProvider` redacta las candidatas, así que la espera es la de una sola llamada. La entrevista dura entre 4 y 10 preguntas y se corta cuando la confianza del perfil es suficiente.
2. **Afinando.** El perfil de ánimo se calcula con decisiones `score` (una por atributo) y `noul` (una por grupo de estilos). Después se ordena el catálogo por parecido con el perfil, el `DecisionProvider` comprueba si cada candidata encaja, y Gemini escribe el porqué de cada una. La pantalla muestra estos pasos en directo mediante Server-Sent Events.
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

- **IA detrás de interfaces** (`apps/api/src/ai`): `DecisionProvider` (choice, score y noul, las primitivas de Jev), `TextProvider` y `EmbeddingProvider`.
  - Con `DECISION_PROVIDER=gemini`, las decisiones usan `experimental_decide` del AI SDK con `google.decisionModel()`.
  - Con `DECISION_PROVIDER=jev`, se usa Jev (`@typesafe-ai/sdk`), y Gemini queda de respaldo si Jev falla.
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
cp .env.example .env        # y rellena GEMINI_API_KEY y JAMENDO_CLIENT_ID
pnpm install
docker compose up -d        # PostgreSQL 17 + pgvector en el puerto 5434
pnpm db:migrate
pnpm seed                   # ~800 canciones de Jamendo
pnpm dev                    # API en :3001 y web en http://localhost:5173
```

Otros comandos: `pnpm storybook` (en :6006), `pnpm test` (pruebas del motor), `pnpm typecheck` y `pnpm tokens`.

## Datos y licencias

La música viene de Jamendo con licencias Creative Commons; el reproductor enlaza cada pista con su página original.
