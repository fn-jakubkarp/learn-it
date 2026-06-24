# Learn-it

> Un pipeline de aprendizaje con IA que construye conocimiento duradero: repetición espaciada, recuerdo activo y una puntuación de dominio que no puedes falsear.

<!-- README-I18N:START -->

[English](./README.md) | [中文](./README.zh.md) | **Español** | [Polski](./README.pl.md) | [日本語](./README.ja.md) | [Deutsch](./README.de.md)

<!-- README-I18N:END -->

Reconocer no es recordar. Puedes reconocer una respuesta cuando la ves y, aun así, no ser capaz de recuperarla de la memoria sin pistas. Learn-it está hecho para el segundo tipo de saber: genera una ruta de aprendizaje personalizada y luego te guía a través de métodos probados de la ciencia cognitiva -repetición espaciada (FSRS), recuerdo activo, Feynman, profundidad de Bloom y la escalera de habilidad de Dreyfus- hasta que el conocimiento realmente se asienta en la memoria a largo plazo.

Lo dirige una IA mediante la habilidad `/learn-it`. La IA te diagnostica, te enseña y te califica; una CLI ligera en Bun es el motor que invoca y solo registra lo que de verdad demuestras.

> [!NOTE]
> El dominio se **calcula a partir del desempeño registrado, nunca se autodeclara.** Hacer trampa con tu propia puntuación es justamente la ilusión de competencia que esta herramienta existe para vencer, así que editar un archivo no puede moverlo.

## Características

- **Ruta personalizada**: un diagnóstico evalúa lo que ya sabes y descompone una materia en hojas del tamaño de un concepto, de modo que te saltas lo que ya dominas y no te sobrecargas cognitivamente.
- **Repetición espaciada a nivel de concepto**: cada *concepto* (no cada tarjeta) lleva su propia programación FSRS, que avanza con cualquier vía que uses para reforzarlo: reexplicar, hacer un test, releer o una tarjeta.
- **Recuerdo activo por muchas vías**: las tarjetas son una vía, no el objetivo. Reexplicar (Feynman), responder a una pregunta de test incisiva o hacer una pequeña tarea real cuentan; releer de forma pasiva se acredita solo como reconocimiento, nunca como prueba.
- **Dominio severo e imposible de falsear**: un nivel de Dreyfus por materia (`novice → … → expert`), agregado a partir de un registro de solo anexado de recuerdos calificados y evaluaciones puntuadas con rúbrica. El volumen nunca sube de nivel; `expert` exige una construcción real más durabilidad a lo largo del tiempo.
- **Un vigilante, no raíles**: la fase se *infiere* del estado real, nunca se almacena. Cualquier etapa se ejecuta a demanda; si te adelantas, el vigilante te avisa y te deja decidir.
- **Muchas materias a la vez**: lleva Rust, redes y cocina en paralelo; la cola de repaso intercala lo que vence en todas ellas.
- **Panel web local**: una página `Bun.serve` sin compilación en `localhost:4321` para repasar por tu cuenta entre sesiones.

## Requisitos previos

- [Bun](https://bun.sh) ≥ 1.3: ejecuta todo el motor (CLI, panel, pruebas y el SQLite incorporado). No requiere Node.js.
- `git`.
- Una CLI agéntica para dirigirlo: se recomienda [Claude Code](https://claude.com/claude-code); la habilidad también está integrada para [Qwen Code](https://github.com/QwenLM/qwen-code), [OpenCode](https://opencode.ai) y la [Gemini CLI](https://github.com/google-gemini/gemini-cli).

## Instalación

La línea única instala Bun si hace falta, clona el repositorio, instala las dependencias y crea la base de datos.

**Linux / macOS**

```bash
curl -fsSL https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.sh | bash
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.ps1 | iex
```

<details>
<summary>O instala manualmente</summary>

```bash
git clone https://github.com/fn-jakubkarp/learn-it.git
cd learn-it
bun install
bun src/init-db.ts          # create data/learn_it.db
bun run verify              # optional: biome + tsc + bun test
```

</details>

## Uso

Abre tu CLI agéntica **dentro del repositorio** -el motor se ejecuta con la raíz del repositorio como directorio de trabajo- y llama a la habilidad. Sin argumento muestra el panel de todas las materias; un argumento indica una etapa. Learn-it está pensado para que lo dirija la IA, no para teclearlo a mano: el ciclo es conversacional: diagnosticar → conversar → planificar → reexposición espaciada → verificar.

```
/learn-it                   # dashboard across all subjects + the command menu
/learn-it init rust         # start a subject (just your goal — no self-inventory)
/learn-it explore-gaps rust # the diagnostic: it tests you and places you, you don't self-report
/learn-it reinforce         # the daily loop: spaced, varied re-exposure of due concepts
```

### Etapas

Cada etapa se ejecuta a demanda; nada está bloqueado. `[subject]` es opcional (actúa sobre todas las materias si se omite); `{…}` es obligatorio.

**Diagnosticar y planificar**

| Etapa | Qué hace |
| --- | --- |
| `/learn-it` | Lanza el panel y luego imprime el estado y el menú de comandos de todas las materias. |
| `init {subject} [slug]` | Crea el andamiaje de la materia y captura tu **objetivo** (por qué + meta). Asigna un **slug** corto y ascii (p. ej. `egzamin-krotkofalowca-klasa-1`) — el id estable y seguro entre comillas que pasas a los comandos posteriores (el nombre completo también funciona). Sin autoinventario: la ubicación se mide, no se declara. |
| `explore-topic {subject}` | Mapea **todo** el territorio en conceptos y lo registra — la cobertura viene del campo, no de tu memoria, así que los huecos sin nombrar también caen en el mapa. |
| `explore-gaps {subject}` | Sondea un concepto a la vez (reaccionas a una señal, no recuerdas en libre), enseña una idea de una línea en cada hueco y escribe un informe 🟢/🟡/🔴 de dónde estás realmente. Fija un `target`. |
| `plan {subject}` | Concilia el mapa con los hallazgos del sondeo; lo ordena de los cimientos hacia arriba. |

**Aprender y anclar**

| Etapa | Qué hace |
| --- | --- |
| `concept {term}` | Enseña por analogía + mecanismo; tú lo reformulas en `notes.md`. |
| `anchor {facts}` | Mnemotecnia solo para datos en bruto (sintaxis, nombres, fechas). |
| `extract {subject}` | Convierte tus notas en tarjetas. |

**Recordar y espaciar**

| Etapa | Qué hace |
| --- | --- |
| `reinforce [subject]` | **El ciclo diario**: reexposición espaciada y variada de los conceptos que vencen, los más débiles primero. |
| `review [subject]` | Recuerdo con tarjetas, calificado y con retroalimentación al fallar. |
| `quiz {subject} {concept}` | Una pregunta incisiva de recuerdo/aplicación. |

**Verificar y calificar**

| Etapa | Qué hace |
| --- | --- |
| `feynman {subject}` | Tú lo explicas; la IA sondea lagunas → registra evidencia de `explain`. |
| `exam {subject}` | Una prueba difícil sobre un problema *nuevo* → registra evidencia de `apply`. |
| `assess {subject} [kind]` | Emite una tarea estructurada para casa (`explain`/`apply`/`build`) dirigida a tu punto débil. |
| `evaluate {subject} {kind} {0-100} [file]` | Puntúa una entrega contra una rúbrica fija (≥ 70 aprueba) y cierra la tarea. |
| `mastery {subject}` | Nivel actual, % hasta el siguiente y qué lo está bloqueando exactamente. |

> [!NOTE]
> `build` es el tipo hito: un artefacto pequeño pero real, interrogado antes de puntuarlo. Un `build` aprobado es la única vía hacia la evidencia que exige una calificación de `expert`.

Para repasar por tu cuenta entre sesiones, el panel local no necesita IA:

```bash
bun src/dashboard.ts        # → http://localhost:4321
```

> [!TIP]
> Para que `/learn-it` esté disponible desde cualquier proyecto, instálalo como plugin de Claude Code: `/plugin marketplace add fn-jakubkarp/learn-it` y luego `/plugin install learn-it@learn-it`. El motor sigue ejecutándose desde el repositorio clonado, así que conserva el clon.

> [!IMPORTANT]
> Las llamadas directas a `bun src/learn-it.ts <cmd>` son el motor que dirige la habilidad, no un flujo de trabajo manual. Úsalas directamente solo para inspeccionar o automatizar tus datos (`export`, `doctor`, `db`).

## Cómo funciona

**Dos niveles.** Una *materia (subject)* es lo que dominas (p. ej. «Rust») y lleva la ruta, la fase y el nivel de Dreyfus. Un *concepto (concept)* es una hoja del tamaño de una lección debajo de ella (p. ej. «ownership»); las tarjetas se enganchan ahí. La ruta es la lista de conceptos, y el dominio se agrega a partir de ella: no puedes ser «experto» en un solo dato.

**Las fases son un mapa, no una vía férrea.** Learn-it lee tu estado real (¿conceptos mapeados? ¿*sondeados*? ¿tarjetas repasadas?) para inferir dónde se sitúa cada materia — diagnose se deja atrás cuando te han examinado, nunca cuando has rellenado un formulario. Nada está bloqueado.

```
diagnose → conceptualize → recall → space → verify → mastered
```

**El dominio se gana y es independiente del medio.** Subir de nivel requiere retención demostrada (recordar un concepto tras un intervalo real, no el mismo día) más evidencia que no sean tarjetas: explicarlo, aplicarlo a problemas nuevos y, para `expert`, construir algo real. El espaciado cuenta el tiempo real transcurrido, así que machacar el mismo día no mueve nada.

**Las evaluaciones son por plantilla, no improvisadas.** `assess` emite una tarea desde una plantilla fija; tú la entregas; `evaluate` la puntúa contra una rúbrica fija para que la calificación no se desvíe. Un `build` aprobado es la única vía hacia la evidencia que exige `expert`.

### Modelo de propiedad

| Asunto | Propietario | Archivos |
| --- | --- | --- |
| **Conocimiento** | lo escribes tú, el motor solo lee | `subjects/<s>/{audit,notes,roadmap}.md`, `assessments/*.md` |
| **Estado** | propiedad del motor, no editar a mano | `data/learn_it.db` (tarjetas, registro de recuerdo, evidencia) |
| **Motor** | lógica + prompts versionados | `src/*.ts`, `stages/*.md`, `templates/*` |

La única regla: el motor escribe el *Estado*, lee el *Conocimiento* y nunca edita un archivo escrito por ti.

### El motor

| Archivo | Rol |
| --- | --- |
| `src/learn-it.ts` | Enrutador de sesión: panel, vigilante, conceptos, tarjetas, assess/evaluate, dominio, notas, `export`, `doctor`. |
| `src/lifecycle.ts` | Infiere la fase de una materia y aconseja (nunca bloquea). |
| `src/scheduler.ts` | Núcleo FSRS para tarjetas; registra cada recuerdo contra el tiempo real transcurrido. |
| `src/exposure.ts` | Exposición espaciada a nivel de concepto (la cola `reinforce`), avanzada por cualquier vía. |
| `src/mastery.ts` | Niveles de Dreyfus, agregados sobre conceptos + evidencia (el volumen no puntúa). |
| `src/init-db.ts` | Crea / migra el esquema SQLite. |
| `src/dashboard.ts` | Panel web local sin compilación. |

Consulta [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para el diseño completo.

## Agradecimientos

El enrutador de habilidades y el andamiaje de prompts por etapa se inspiran en [career-ops](https://github.com/santifer/career-ops) (MIT). La metodología, el motor de programación y la lógica de dominio de Learn-it son propios.
