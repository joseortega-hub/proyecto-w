# Diseño de Sintonía (Fase 0)

Aprobado el 23/10/2026. Nombre provisional del producto: **Sintonía** (el repositorio sigue llamándose Proyecto X).

- Lienzo de diseño (tipo Design, privado): https://claude.ai/artifact/Uzikzt5ig9T1h8cx9wPFNE
- Primera propuesta en HTML (superada por el lienzo): https://claude.ai/artifact/DfhKKDAkemtEk22zCZ1XAb

## Recursos en este repositorio

| Ruta | Contenido |
|---|---|
| `docs/design/canvas/` | Fuente de los 13 tableros del lienzo (`canvas.json` + `*.dc.html`) |
| `docs/design/tokens.json` | Tokens de diseño en formato W3C DTCG 2025.10 |
| `docs/design/theme.css` | Los mismos tokens como variables de Tailwind CSS v4 (convención shadcn/ui) |
| `docs/design/gen-tokens.mjs` | Script que genera `tokens.json` y `theme.css`: `node docs/design/gen-tokens.mjs docs/design` |
| `docs/design/propuesta-v1.html` | Primera propuesta en una sola página |

## Decisiones aprobadas

1. **Nombre:** Sintonía.
2. **Respuestas de la entrevista:** Sí, No y un "No lo sé" discreto, que el motor trata como "sin información".
3. **Duración:** entre 4 y 10 preguntas. Termina en cuanto la confianza del perfil supera un umbral.
4. **Identidad:** azul cobalto para la interfaz, naranja de señal solo para el encaje, neutros azulados; Bricolage Grotesque, Atkinson Hyperlegible y JetBrains Mono.
5. **Películas:** el reproductor de ese dominio muestra tráiler y ficha (TMDB no ofrece películas completas).
6. **Cuentas:** sin registro en el MVP. Las listas se guardan en el dispositivo.

## Mapa de pantallas

Flujo principal: Inicio → Dominio → Entrevista (bucle) → Afinando → Resultado → Reproductor. La biblioteca, la ficha del elemento y Mis listas se abren desde la navegación en cualquier momento.

| Pantalla | Ruta | Papel de la IA |
|---|---|---|
| Inicio | `/` | Ninguno |
| Dominio | `/dominio` | Ninguno. Se salta si solo hay un dominio activo |
| Entrevista | `/entrevista/:sesion` | Jev `choice` elige la siguiente pregunta o termina; Gemini la redacta junto con su motivo |
| Afinando | estado de carga de `/resultado` | Jev `score` calcula el perfil, pgvector busca candidatos, Jev `noul` filtra cada uno |
| Resultado | `/resultado/:id` | Gemini explica cada elección; los chips de afinar relanzan la búsqueda |
| Reproductor | `/reproductor` | Muestra la explicación de lo que suena |
| Biblioteca | `/biblioteca`, `/listas` | Ninguno |
| Ficha | `/biblioteca/:itemId` | Similares por embedding |

En móvil la navegación va abajo y hay un mini-reproductor. A partir de 768 px la navegación pasa a ser lateral y el reproductor se convierte en una barra inferior. La entrevista y Afinando se muestran sin navegación.

## Componentes (shadcn/ui + Radix + Tailwind CSS v4)

Estructura de `apps/web/src/components/`:

- `ui/`: código generado con `npx shadcn add`. Se toca lo mínimo y las páginas no lo importan directamente.
- `atoms/`, `molecules/`: envuelven `ui/` con nuestras variantes (cva) y la API del dominio.
- `organisms/`, `templates/`: bloques con datos y marcos de pantalla, sin llamadas a la API.
- `pages/`: conectan rutas, datos (TanStack Query) y estado.

Los componentes hablan de "elementos" y no de "canciones" para servir a cualquier dominio. Los atributos (energía, voz, BPM…) salen de la configuración del dominio.

| Nivel | Componente | Base |
|---|---|---|
| Atom | Button | shadcn Button |
| Atom | AnswerButton (variantes yes/no) | shadcn Button |
| Atom | IconButton | shadcn Button `size=icon` |
| Atom | Icon | lucide-react |
| Atom | Heading, Text | propio |
| Atom | Chip, MatchBadge | shadcn Badge |
| Atom | Cover | shadcn AspectRatio |
| Atom | Meter | shadcn Progress |
| Atom | Dial | propio |
| Atom | Skeleton, Spinner | shadcn Skeleton, Spinner |
| Atom | Input | shadcn Input + Label |
| Atom | Slider | shadcn Slider |
| Atom | Kbd | shadcn Kbd |
| Molecule | AnswerPair | propio |
| Molecule | QuestionCard | shadcn Card |
| Molecule | InterviewProgress | propio |
| Molecule | AttributeMeter | shadcn Progress |
| Molecule | ItemRow | propio |
| Molecule | Explanation | shadcn Collapsible |
| Molecule | SearchBar | shadcn Input |
| Molecule | FilterChips, RefineChips | shadcn ToggleGroup |
| Molecule | PlaybackControls | shadcn Button |
| Molecule | SeekBar | shadcn Slider |
| Molecule | DomainCard | shadcn RadioGroup |
| Molecule | EmptyState | propio |
| Molecule | Toast | shadcn Sonner |
| Organism | AppHeader, BottomNav | propio |
| Organism | SideNav | shadcn Sidebar |
| Organism | InterviewPanel, PipelineSteps | propio |
| Organism | MoodProfile, ItemDetail | shadcn Card |
| Organism | ResultList | shadcn Accordion |
| Organism | MiniPlayer, PlayerBar | propio |
| Organism | FullPlayer | shadcn Drawer |
| Organism | QueueSheet | shadcn Sheet |
| Organism | CatalogBrowser | shadcn Tabs |
| Organism | DomainPicker | shadcn RadioGroup |
| Template | AppShell | shadcn SidebarProvider |
| Template | FocusTemplate, ListDetailTemplate, DetailTemplate, LandingTemplate | propio |
| Page | HomePage, DomainPage, InterviewPage, TuningPage, ResultPage, PlayerPage, LibraryPage, ItemPage | propio |

Storybook: una historia por variante y estado (cargando, vacío, error), con selector de tema en la barra de herramientas y los tokens cargados desde `theme.css`.

## Identidad y tokens

- **Colores semánticos:** los nombres de shadcn/ui (`background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`…) más `signal`, `signal-foreground`, `signal-muted`, `yes` y `no`.
- **Modo oscuro:** en `tokens.json` cada token semántico apunta a un color base en `$value` (claro) y a otro en `$extensions["app.sintonia.modes"].dark`. En `theme.css` son `:root` y `.dark`, y se elige con la clase `dark` siguiendo al sistema por defecto.
- **Texto:** 12 · 14 · 16 · 20 · 25 · 31 · 39 · 49 px (razón 1,25).
- **Espaciado:** múltiplos de 4 px (`--spacing: 0.25rem`).
- **Radios:** 6 · 12 · 20 px y píldora.
- **Sombras:** sm, md y lg, con tinte azul.
- **Movimiento:** 120 ms y 200 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- **Accesibilidad:** contraste AA (4,5:1) en los dos temas, objetivos táctiles de 44 px como mínimo, y Sí/No reconocibles también sin color (texto y posición fija).
