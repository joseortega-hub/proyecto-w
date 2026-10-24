# Auditoría responsive (24/10/2026)

Método: `apps/web/scripts/audit-responsive.js` (se importa en la web en marcha: `await import('/scripts/audit-responsive.js')`, luego `await __sum(ancho, alto, rutas)`). Monta iframes del ancho pedido y mide desbordes (documento y elementos), zonas táctiles < 44 px, texto cortado, imágenes deformadas, elementos fijos y la altura útil de `main`.
Anchos: 320, 360, 375, 414, 768, 1024, 1280, 1440 y móvil horizontal 667×375. Temas probados: Sintonía (por defecto), Neón (fuente ancha, Unbounded) y Brutal (radio 0; solo comprobado visualmente por tokens, sin desbordes). Datos: API de producción con una sesión real de Música.
Pantallas recorridas: selector, inicio de las 6 temáticas, entrevista, Afinando/resultado con "Tu vibra", biblioteca, ficha, listas, Mis gustos, Bajo el capó, reproductor, menú de temas (320).

**Resultado general:** no hay desbordes horizontales del documento en ningún ancho ni tema. Los problemas reales eran zonas táctiles, zonas seguras (notch/PWA), móvil en horizontal y las barras de "Tu vibra" que se movían al hacer scroll.

| # | Pantalla | Ancho | Problema | Gravedad | Selector / evidencia | Estado |
|---|----------|-------|----------|----------|----------------------|--------|
| 1 | Todas con navegación | 360–414 y horizontal | "Tu vibra": al hacer scroll por encima de las barras se movían sin querer (`touch-none`) | Grave | `VibeSlider` | Resuelto: al tacto `touch-action: pan-y`; se agarran con pulsación larga de 300 ms (vibración, se iluminan y crecen), se cancelan si el dedo se mueve > 8 px, y botón "Ajustar/Listo" (modo edición, se cierra al tocar fuera). Teclado y lector siguen como slider. Pista la primera vez |
| 2 | AppShell, Focus (entrevista), selector, Bajo el capó | móvil/PWA | Sin `env(safe-area-inset-*)` arriba ni a los lados: la cabecera quedaba bajo el notch/barra de estado y el contenido bajo el notch en horizontal | Grave | `viewport-fit=cover` sin padding | Resuelto: utilidades `pt-safe` y `px-safe` en las 4 plantillas |
| 3 | Todas con cabecera/navegación | 667×375 | Cabecera + pestañas + navegación dejaban 191 px de 375 (51 %) para el contenido | Grave | `main` 191/375 | Resuelto: variante `short`; cabecera en una fila y navegación con icono y texto en línea → 278/375 |
| 4 | Cabecera, pestañas de temática | < 768 | Enlace de marca 26 px y pestañas/"Todas" de 36 px | Medio | `AppHeader a`, `DomainTabs button` | Resuelto: 44 px en táctil (variante `touch`) |
| 5 | Resultado, ficha | < 768 | "Por qué" 32 px, "Me gusta"/"No es para mí" 36 px | Medio | `Explanation`, `FeedbackButtons` | Resuelto: 44 px en táctil |
| 6 | Mis gustos, biblioteca, inicio de Videojuegos | < 768 | Chips de gustos 36 px; selectores de plataforma/idioma y de refinar 36–40 px; hoja de temas 36 px | Medio | `TasteChip`, `PreferencePicker`, `RefineChips`, `ThemePicker` | Resuelto: 44 px en táctil |
| 7 | Bajo el capó | < 768 | Interruptor "Modo demo" 48×28 | Medio | `Switch` | Resuelto: zona pulsable ampliada con `::before` (44 px de alto); el aviso del script queda como falso positivo |
| 8 | Entrevista con modo demo | < 768 | Panel del modo demo sin zona segura inferior y botón "Ocultar" pequeño | Medio | `DemoDock` | Resuelto: padding inferior seguro y 44 px en táctil |
| 9 | Reproductor con vídeo | < 768 | Miniatura de vídeo fija a 148 px del borde, sin zona segura | Bajo | `VideoDock` | Resuelto: suma `env(safe-area-inset-bottom)` |
| 10 | Biblioteca, resultado, ficha | todos | Enlace "Jamendo" (atribución, 18 px) e input de búsqueda (23 px) | Bajo | `SourceAttribution a`, `SearchField input` | Sin cambio: enlace en línea dentro de texto (exento) y el input va dentro de un `label` de 44 px que lo enfoca |
| 11 | Entrevista, tarjeta "esto es lo que he entendido", Inicio | todos | Sin medir en profundidad: la sesión "Refuerzo de la entrevista" está cambiando su estructura (respuesta libre, voz). Solo se tocaron clases en `FocusTemplate` | — | `InterviewPage`, `UnderstandingCard`, `HomePage` | Pendiente tras el refuerzo: repasar con el script en 320/360 y con Neón |
| 12 | Mi carpeta / Mi YouTube con sesión iniciada, reproductor completo y mini con música sonando | móvil | Requieren cuenta de Google, carpeta local o audio real; la medición automática no pudo montarlas. Estructura revisada: mini-reproductor y navegación son filas del `flex-col` (no tapan el contenido) | Bajo | `AppShell`, `MiniPlayer`, `FullPlayer` | Pendiente de comprobar a mano en el móvil |
| 13 | Panel del modo demo | < 768 | Es un panel fijo (34 dvh) que tapa la navegación mientras está abierto | Bajo | `DemoDock` | Aceptado: es un panel temporal con "Ocultar" |
| 14 | Escritorio | ≥ 768 | Controles de 36–40 px | Info | — | Sin cambio a propósito: puntero fino, densidad de escritorio |

## Re-auditoría
- 320/360/375/414/768: sin desbordes; táctiles < 44 px solo los falsos positivos de la fila 7 y 10.
- 667×375: `main` 278/375 (antes 191).
- 1440: sin desbordes; los controles de 36–40 px son la fila 14.
- "Tu vibra" probado en 375 px con eventos de puntero táctil: mover el dedo antes de 300 ms (scroll) no cambia el valor; mantener 300 ms y arrastrar sí (10 → 70), `touch-action: pan-y` en reposo y `none` al agarrar.

## Storybook
Vistas añadidas (móvil 320/360/414, horizontal, tableta, escritorio). Historias nuevas: `DomainTabs` (Movil320, Escritorio), `DemoDock` (MovilHorizontal), `VibeSlider` (ModoEdicion), `VibeCard` (Movil360Tactil).

## Segunda pasada (tras "Hoy para ti", Tu historia, Modo Perreo y entrevista conversacional)
Mismo script en 320, 360, 375 y 667×375 sobre `/`, `/music`, `/games`, resultado, biblioteca, ficha, gustos, listas, `/historia` y artistas: sin desbordes, sin texto cortado, táctiles de 44 px (solo el enlace en línea "Jamendo"), `main` en horizontal 278/375. La navegación de 5 pestañas (con "Tu historia") cabe en 320 px. Las clases `touch:`, `short:` y `pt-safe` siguen intactas en los átomos y plantillas.
