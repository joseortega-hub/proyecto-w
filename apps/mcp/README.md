# Sintonía dentro de Claude (MCP)

Servidor [MCP](https://modelcontextprotocol.io) de Sintonía con el SDK oficial (`@modelcontextprotocol/sdk`) y transporte stdio. Expone el catálogo y la generación de listas a cualquier cliente MCP: Claude Desktop, Claude Code o el inspector.

No duplica lógica: todo pasa por la API REST de `apps/api`, con las mismas cadenas de IA, cupos y gustos. Node 24 ejecuta el TypeScript directamente (eliminación de tipos), así que no hay paso de compilación.

## Herramientas

| Herramienta | Qué hace |
|---|---|
| `listar_tematicas` | Temáticas con su tamaño, preferencias previas (idioma, plataforma…) y ajustes. |
| `buscar_en_biblioteca` | Busca por texto y/o etiquetas en una temática. |
| `ver_ficha` | Ficha de un elemento con enlaces y parecidos por embedding. |
| `crear_lista` | Lista a partir de una petición en texto ("hazme una lista para el gimnasio"), con % de encaje y explicación por elemento. |
| `empezar_entrevista` / `responder_pregunta` | La entrevista de sí/no dentro del chat: Claude hace las preguntas y, al terminar, devuelve la lista. |
| `ajustar_lista` | Relanza una lista con ajustes rápidos (`more-energy`, `shorter`…) sin repetir la entrevista. |
| `ver_mis_gustos` / `editar_mis_gustos` | "Mis gustos" de la persona del MCP; acepta identificadores o texto libre. |
| `valorar_elemento` | 👍/👎 a un elemento, que ajusta los gustos. |

También hay un *prompt* `lista_para` ("Lista para un momento") para lanzar la demo desde el menú de prompts.

### Cómo responde `crear_lista` a la entrevista

La petición se usa como **punto de partida** (`initialText`), igual que el texto o la voz de la web:

1. Al empezar, la API ya descarta las dimensiones que la petición deja claras (`text_signals`), así que no se preguntan.
2. Cada pregunta restante se responde con `POST /api/sessions/:id/auto-answer`: un `choice` de sí / no / no lo sé con la cadena rápida de la entrevista (Groq → Laya → Gemini). La petición viaja en el `state` como dato, nunca como instrucción. Con confianza menor de 0,6, la respuesta se queda en "no lo sé".
3. Si el texto ya no da para más (dos "no lo sé" seguidos con el mínimo de preguntas cubierto), la entrevista termina en ese momento en lugar de agotar el máximo de preguntas.
4. Afinando (perfil, pgvector, encaje y explicaciones) es el mismo de la web, con avisos de progreso MCP en cada paso.

Por qué así y no con valores por defecto: "no lo sé" es la única respuesta honesta cuando el texto no dice nada. No inventa nada en el perfil, a diferencia de un "sí" o un "no" fijos, y aprovecha todo lo que la petición sí dice ("gimnasio" → "¿Vas a entrenar duro hoy?" → sí). Además, la respuesta sale de la misma entrevista adaptativa que en la web, así que la lista es comparable y queda explicada: la salida incluye las preguntas y lo que se respondió por la persona. Cuesta unas 2-3 decisiones rápidas por pregunta (la respuesta y la precarga de la siguiente) y una lista típica sale con 4-6 preguntas.

Para la demo en vivo está también el modo interactivo: Claude hace las preguntas de verdad.

Las listas y los gustos van ligados a una persona anónima fija del MCP (`SINTONIA_USER_ID`), distinta de la del navegador.

## Configuración

| Variable | Por defecto |
|---|---|
| `SINTONIA_API_URL` | `http://localhost:3001/api` |
| `SINTONIA_WEB_URL` (enlaces a fichas y listas) | `http://localhost:5173` |
| `SINTONIA_USER_ID` (UUID de la persona del MCP) | `6d637000-5e17-4a1a-8000-000000000001` |
| `SINTONIA_TIME_ZONE` (contexto automático) | La del sistema |

### Claude Desktop

1. Arranca Postgres y la API (`docker compose up -d` y `pnpm dev`, o solo la API).
2. En Claude Desktop: *Configuración → Desarrollador → Editar configuración*. Se abre `claude_desktop_config.json` (en Windows, `%APPDATA%\Claude\claude_desktop_config.json`; en macOS, `~/Library/Application Support/Claude/claude_desktop_config.json`).
3. Añade el servidor dentro de `mcpServers` (ejemplo completo en [`claude_desktop_config.example.json`](claude_desktop_config.example.json)):

   ```json
   "sintonia": {
     "command": "C:\Program Files\nodejs\node.exe",
     "args": ["C:\Proyecto X\apps\mcp\src\index.ts"],
     "env": { "SINTONIA_API_URL": "http://localhost:3001/api" }
   }
   ```

   Con Node en el `PATH` vale `"command": "node"`. Hace falta Node 24 o superior.
4. Reinicia Claude Desktop por completo. "sintonia" aparece en el menú de herramientas (icono de conectores).

### Claude Code

```bash
claude mcp add sintonia -e SINTONIA_API_URL=http://localhost:3001/api -- node "C:/Proyecto X/apps/mcp/src/index.ts"
```

### Inspector y cliente de prueba

Desde `apps/mcp`:

```bash
pnpm inspect                     # interfaz web del inspector oficial
npx mcp-inspector --cli -e SINTONIA_API_URL=http://localhost:3001/api node src/index.ts --method tools/list
pnpm demo crear_lista '{"tematica":"music","peticion":"hazme una lista para el gimnasio"}'
```

`demo` es un cliente MCP mínimo (`scripts/demo.ts`): arranca el servidor por stdio, como Claude Desktop, y muestra el progreso y el tiempo total.

## Demo en directo (guion)

Antes: API arrancada, Claude Desktop con el servidor conectado y, si se quiere abrir las listas, la web en marcha.

1. **"¿Qué temáticas tiene Sintonía?"** → `listar_tematicas`.
2. **"Hazme una lista de música para el gimnasio, en español"** → `crear_lista` con `{"language":"es"}`. Enseña las preguntas respondidas a partir de la petición, el % de encaje y la explicación de cada canción, y el enlace a la lista en la web (con reproductor). Tarda entre 30 y 50 segundos, la mayoría en Afinando (Gemini en el plan gratuito).
3. **"Ponle más energía"** → `ajustar_lista` con `more-energy`, sin repetir la entrevista.
4. **"Juguemos: hazme tú las preguntas para elegir un videojuego"** → `empezar_entrevista` + `responder_pregunta`: Claude hace la entrevista de sí/no en el chat.
5. **"Me encantan Pokémon y los juegos de mundo abierto, odio el terror"** → `editar_mis_gustos` traduce el texto a etiquetas del catálogo; la siguiente lista lo tiene en cuenta ("Va con tus gustos: …").
6. **"Cuéntame más del primero"** → `ver_ficha`, con los parecidos por embedding.

Medido en local (24/10/2026): `crear_lista` de música para el gimnasio, 5 preguntas respondidas solas y 12 canciones del 68 al 92 % en ~47 s. Entrevista interactiva de videojuegos ("tengo una hora libre y quiero algo relajado"): 3 preguntas y Mini Metro al 94 %.

## Pruebas

`pnpm --filter @sintonia/mcp test`: un cliente MCP real en memoria contra el servidor, con una API falsa (herramientas, `crear_lista` de punta a punta, errores, ficha y lectura de SSE).
