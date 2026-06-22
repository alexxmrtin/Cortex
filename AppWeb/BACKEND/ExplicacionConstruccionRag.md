# Explicación de la construcción del RAG

Documento didáctico que explica, fase a fase, cómo se ha ido construyendo el motor RAG de Cortex y por qué se ha tomado cada decisión.

---

## Fase 0

La idea de esta fase es **dejar montados los cimientos** del nuevo RAG: las dependencias, la configuración, la tabla donde guardaremos los fragmentos y las dos piezas base del motor (el que convierte texto en vectores y el que los almacena). Todavía no indexamos ni recuperamos nada — eso es Fase 1 en adelante. Aquí solo preparamos el terreno.

### Antes de nada: ¿qué es un RAG y por qué estas piezas?

Un RAG funciona así: cogemos tus archivos, los partimos en trozos, convertimos cada trozo en un **vector** (una lista de números que captura su "significado"), y los guardamos en una **base vectorial**. Cuando preguntas algo, convertimos tu pregunta en otro vector y buscamos los trozos cuyos vectores se parecen más → esos son el contexto que le damos a la IA.

La Fase 0 prepara las dos herramientas centrales de eso: **convertir texto en vectores** (Embeddings) y **guardarlos/buscarlos** (VectorStore), más el sitio donde guardar el texto de cada trozo (la tabla ChunkArchivo).

---

### 1. Dependencias nuevas (`requirements.txt`)

Añadí tres librerías:

- **`chromadb`** → la base de datos vectorial. Es "embebida": vive en un archivo en disco, sin levantar otro servidor (como SQLite pero para vectores).
- **`sentence-transformers`** → la librería que carga los modelos de IA **locales** que convierten texto en vectores (BGE-M3) y que reordenan resultados (el reranker). "Local" = corre en tu máquina, sin llamar a ninguna API de pago.
- **`rank-bm25`** → un buscador por **palabras exactas** (lo usaremos en Fase 2 para la búsqueda híbrida; lo dejo declarado ya).

La pega: `sentence-transformers` arrastra `torch`, que son ~2 GB. Por eso **no se instaló todavía** en el `.venv` local — queda como decisión (instalar en local vs. dejarlo para Docker).

---

### 2. Configuración (`config.py` y `.env.example`)

Añadí cinco "ajustes" a la clase `Settings`, todos con valor por defecto:

| Ajuste | Para qué |
|--------|----------|
| `RAG_PERSIST_DIR` | dónde Chroma guarda sus archivos (`Storage/ChromaDB`) |
| `EMBEDDING_MODEL` | qué modelo convierte texto→vector (`BAAI/bge-m3`) |
| `RERANKER_MODEL` | qué modelo reordena resultados (Fase 2) |
| `RAG_TOP_K` | cuántos trozos recuperar en bruto (50) |
| `RAG_TOP_N` | cuántos quedan tras filtrar y van al prompt (8) |

Como tienen default, la app funciona sin tocar el `.env`. En `.env.example` los dejé comentados por si en el futuro quieres cambiarlos sin editar el código.

---

### 3. La tabla `ChunkArchivo` (el modelo)

Aquí hay un punto que conviene entender bien: **el vector y el texto se guardan en sitios distintos**.

- El **vector** (los números) va a Chroma.
- El **texto del trozo y sus metadatos** van a una tabla normal de Postgres: `ChunkArchivo`.

¿Por qué duplicar y no meterlo todo en Chroma? Por tres razones que dejé escritas en el propio modelo:

1. **BM25** (el buscador por palabras de Fase 2) necesita el texto plano para funcionar.
2. **Las citaciones**: para decir "esto sale de `MensajeController.py`, líneas 80-110" necesito guardar de qué archivo y de qué líneas vino cada trozo. Por eso los campos `linea_inicio` y `linea_fin`.
3. **Reindexar sin duplicar**: si re-subes un archivo, primero borro sus trozos viejos y meto los nuevos.

Cada trozo guarda también `usuario_id` y `proyecto_id`. Esto es **clave para la seguridad**: así puedo filtrar para que un usuario nunca recupere trozos de los proyectos de otro.

Además conecté esta tabla con `ArchivosProyecto` con un `cascade="all, delete-orphan"`. Eso significa: **cuando borras un archivo, sus trozos se borran solos** de la base de datos (los vectores de Chroma los borraré aparte, en el controlador, en Fase 1).

Y la registré en `Models/__init__.py` para que al arrancar la app la tabla se cree automáticamente.

---

### 4. `Embeddings.py` — el traductor texto→vector

Es un envoltorio sobre el modelo BGE-M3. Tres detalles importantes:

- **Se carga una sola vez** (patrón "singleton perezoso"). El modelo es pesado y tarda en cargar, así que no lo cargamos al arrancar la app ni en cada petición: lo cargamos la **primera vez que se usa de verdad** y lo reutilizamos. Es el mismo patrón que ya usabais con el cliente de Redis.
- **El mismo modelo para todo.** Para indexar archivos y para procesar tu pregunta uso el mismo modelo; si fueran distintos, los vectores no serían comparables y la búsqueda no funcionaría.
- **Caché de la consulta en Redis.** Convertir tu pregunta en vector es lo más caro de cada búsqueda, así que guardo ese vector en Redis (reutilizando tu `Cache.py`) por si repites la misma pregunta.

Expone dos funciones: `embeder_documentos()` (para los trozos al indexar) y `embeder_consulta()` (para tu pregunta, con caché).

---

### 5. `VectorStore.py` — el almacén de vectores

Es un envoltorio sobre Chroma. Decisiones:

- **Una sola colección para todos** (`chunks_codigo`). No creo una base separada por usuario o proyecto; en su lugar, **filtro por metadatos** (`usuario_id` + `proyecto_id`) en cada búsqueda. El aislamiento de seguridad va siempre dentro de la consulta. La función `_filtro()` arma ese filtro.
- **También perezoso**: abrir Chroma toca disco, así que el cliente se crea una vez y se reutiliza.
- Expone lo básico: `upsert` (insertar/actualizar trozos), `consultar` (buscar los N más parecidos **siempre acotando por usuario**), y dos de borrado (`borrar_por_archivo`, `borrar_por_proyecto`) para no dejar vectores huérfanos.

Un detalle de idempotencia: los IDs de los trozos en Chroma son deterministas (`"archivo_id:indice"`), así que reinsertar el mismo trozo lo **sobreescribe** en vez de duplicarlo.

---

### 6. Docker (`dockerfile`)

Añadí `ENV HF_HOME=/app/Cache/huggingface`. Traducción: los modelos de IA (~1-2 GB) se descargan de internet la primera vez; con esto se guardan en la carpeta `Cache`, que ya tenías montada como volumen persistente. Así **no se vuelven a descargar cada vez** que reconstruyes o reinicias el contenedor.

---

### ¿Cómo sé que no he roto nada?

Comprobé dos cosas:

1. **Sintaxis** correcta en todos los archivos.
2. **El mapeo de SQLAlchemy es válido** — ejecuté `configure_mappers()` en el `.venv`, que obliga a resolver todas las relaciones (incluida la nueva `chunks` ↔ `archivo`). Pasó, y verifiqué las columnas de la tabla.

Lo que **no** se ejecutó: el servidor entero (necesita la BD levantada) ni la instalación de las dependencias pesadas.

---

### Resumen de la fase

En una frase: **Fase 0 = quedan listas las tuberías** (config, tabla, traductor de vectores y almacén), pero todavía no pasa agua por ellas. El agua empieza a correr en la **Fase 1**, cuando se enganche todo esto a la subida de archivos para indexarlos de verdad.

---

## Fase 1

Aquí **empieza a correr el agua**: conectamos las tuberías de la Fase 0 a la realidad. El objetivo es que, cuando subas un archivo, automáticamente se parta en trozos, se convierta en vectores y se guarde, todo listo para buscar después.

### El flujo general

```
Subes un archivo  →  se guarda en disco (esto ya existía)
                     │
                     ▼  (NUEVO en Fase 1)
                  Ingestion: lee el archivo
                     │
                     ├─ Chunker: lo parte en trozos con sentido
                     ├─ Embeddings: convierte cada trozo en vector   (Fase 0)
                     └─ guarda:
                          • vectores  → Chroma               (Fase 0)
                          • texto + metadatos → tabla ChunkArchivo
```

Se crean **dos piezas nuevas** (`Chunker` e `Ingestion`) y se **engancha** el motor en tres sitios del ciclo de vida de los archivos.

### 1. `Chunker.py` — el que parte los archivos

Es el corazón de la fase y donde más se juega la calidad. No se puede meter un archivo entero como un único vector (un fichero de 500 líneas daría un vector "borroso" que no representa bien nada). Hay que **trocearlo**.

Qué hace:

- **Parte por líneas** acumulando hasta un presupuesto de tamaño (`MAX_CARACTERES = 1600`, ~350-450 tokens). Nunca corta a mitad de línea: respeta los límites naturales.
- Deja un **solapamiento** (`SOLAPAMIENTO_CARACTERES = 240`, ~15%): las últimas líneas de un trozo se repiten al principio del siguiente. Así, una idea que cae justo en el corte no se pierde — queda completa en al menos uno de los dos trozos.
- Guarda de cada trozo **de qué líneas viene** (`linea_inicio`, `linea_fin`). Esto es lo que permitirá las citaciones tipo "esto está en `login.py`, líneas 40-58".
- Deduce el **lenguaje** por la extensión (`.py` → python, `.js` → javascript...).

Detalles de robustez que tiene en cuenta: archivo vacío → no devuelve trozos; una línea gigantesca (un fichero minificado) → se queda como su propio trozo sin romperla; y una **garantía de progreso** para que el bucle de troceado nunca se quede colgado.

En esta fase el troceado es **por líneas con solapamiento** (sencillo y robusto). El troceado "por funciones" con tree-sitter queda como mejora futura.

### 2. `Ingestion.py` — el orquestador

Es el director de orquesta: recibe un archivo y coordina todo el proceso. Por cada archivo:

1. Lee su contenido del disco (de `rutaDisco`). Si es binario o ilegible, lo salta.
2. Llama al **Chunker** para partirlo.
3. Llama a **Embeddings** para vectorizar los trozos.
4. Guarda los vectores en **Chroma** y el texto+metadatos en la tabla **ChunkArchivo**.

El detalle clave es la **idempotencia**: antes de indexar un archivo, **borra sus trozos antiguos** (de Chroma y de la tabla). Así, si re-subes o reindexas un archivo, no se duplican los trozos — siempre queda la versión limpia y actual. Esto funciona porque los IDs de los trozos en Chroma son deterministas (`"archivo_id:indice"`).

Otra decisión importante: `indexar_archivo` **nunca lanza una excepción hacia arriba**. Si el indexado falla, lo registra en el log pero no rompe la subida (el archivo ya está guardado; un fallo de indexado no debe tirar la petición).

### 3. Los enganches (dónde se llama al motor)

La ingesta se conecta a los puntos del ciclo de vida de los archivos, **reutilizando los controladores existentes**. Importante: **los controladores NO tocan `ChunkArchivo` ni Chroma directamente** — solo llaman a funciones de `Ingestion`. Es separación de responsabilidades, igual que con `SSHService` o `MonitorService`.

| Cuándo | Dónde | Qué hace |
|--------|-------|----------|
| Subes un archivo | `subir_archivo` (POST) en `ArchivoProyectoController` | tras guardarlo, llama a `indexar_archivo` |
| Borras un archivo | `eliminar_archivo` (DELETE) | llama a `borrar_archivo` (quita sus vectores de Chroma) |
| Borras un proyecto | `eliminar_proyecto` en `ProyectoController` | llama a `borrar_proyecto` (quita todos los vectores del proyecto) |

Un matiz sobre el borrado: la tabla `ChunkArchivo` **se limpia sola** al borrar un archivo o proyecto, gracias al `cascade` que pusimos en la Fase 0. Lo que hay que borrar **a mano** es lo de **Chroma**, porque vive fuera de la base de datos y el cascade no llega ahí.

### 4. Reindexado de lo ya existente

Los proyectos subidos **antes** de existir el RAG no tienen trozos indexados. Para no tener que volver a subirlos, se añadió un endpoint **`POST /proyectos/{id}/reindexar`** que recorre todos los archivos de un proyecto y los indexa de golpe. Sirve también para reconstruir el índice si algo se corrompe.

### Decisión: indexado síncrono

El indexado se hace **de forma síncrona** dentro de la subida: el `POST` de subir archivo espera a que termine de indexar antes de responder. Es más fácil de razonar y depurar. La alternativa (indexar en segundo plano con `BackgroundTasks` para que la subida responda al instante) queda como mejora futura si la lentitud molesta.

### ¿Cómo sé que funciona?

El `Chunker` es Python puro, así que se probó de forma aislada: un archivo de 120 líneas se parte en 5 trozos, con numeración de líneas correcta (1→120), solapamiento real entre trozos consecutivos, garantía de progreso (sin bucles), y los casos borde controlados (archivo vacío, línea enorme, extensión desconocida).

### Resumen de la fase

**Fase 1 = el agua ya corre**: subir un archivo lo indexa, borrarlo o borrar el proyecto limpia su rastro, y hay un botón de reindexado para lo antiguo. Lo que todavía NO existe es **buscar** sobre eso — recuperar los trozos relevantes para una pregunta. Eso es la **Fase 2** (recuperación híbrida + reranking).

---

## Fase 2

Aquí construimos **la búsqueda**: dada una pregunta, encontrar los trozos de código realmente relevantes. Es "el corazón de la calidad" del RAG. Todavía no respondemos con la IA (eso es Fase 3); solo recuperamos el mejor contexto posible.

### La idea: un embudo de dos pasos

La estrategia es **retrieve-and-rerank** (recuperar y reordenar): primero un filtro **grueso y barato** que reduce miles de trozos a unas decenas, y luego un filtro **fino y caro** que deja solo los mejores.

```
Pregunta
   │
   ├─ 1. SEMÁNTICA (vectorial, Chroma) ─┐
   │                                     ├─ 3. FUSIÓN RRF ─► candidatos
   ├─ 2. LÉXICA (BM25) ─────────────────┘                      │
   │                                                            ▼
   │                                          4. RERANKING (cross-encoder)
   │                                                            │
   └────────────────────────────────────────────────►  TOP_N trozos finos
```

### Por qué DOS búsquedas (híbrida)

Cada búsqueda tiene un punto ciego, y se complementan:

- **Semántica (vectores):** entiende el *significado*. Si preguntas "cómo se valida el usuario", encuentra el código de login aunque no uses esa palabra exacta. Pero **se salta nombres exactos** raros (un identificador como `verificar_token_jwt` o una sigla).
- **Léxica (BM25):** busca por *palabras/identificadores exactos*. Recupera justo lo que la semántica ignora: nombres de función, variables, siglas, códigos.

Juntas cubren ambos casos. En el roadmap esto es "imprescindible".

### 1. `Retrieval.py` — el orquestador de la búsqueda

Es quien coordina todo el embudo. Sus pasos:

1. **Carga el corpus del proyecto.** Trae de la BD todos los chunks del proyecto (uniendo `ChunkArchivo` con `ArchivosProyecto` para conseguir la `rutaRelativa`, que `ChunkArchivo` no guarda). Esto sirve a la vez como corpus de BM25 y como "fuente de la verdad" de cada candidato (su texto y metadatos). Siempre filtrando por `usuario_id` + `proyecto_id` (**aislamiento**).
2. **Búsqueda léxica (BM25).** Tokeniza los textos y la pregunta (minúsculas, partiendo por palabras/identificadores) y puntúa. Devuelve un ranking de trozos.
3. **Búsqueda semántica (Chroma).** Vectoriza la pregunta y pide a Chroma los más cercanos, acotando por usuario y proyecto. Devuelve otro ranking.
4. **Fusión RRF.** Combina los dos rankings en uno (ver abajo).
5. **Reranking.** Pasa los candidatos fusionados al reranker, que deja los `RAG_TOP_N` (8) mejores.

Un detalle de robustez: si **una** de las dos búsquedas falla (p. ej. Chroma da error), se registra y se sigue con la otra. La recuperación no se cae por perder una pata.

### 2. La fusión RRF (Reciprocal Rank Fusion)

Problema: la búsqueda semántica y la léxica dan notas en escalas distintas que no se pueden sumar directamente. RRF lo resuelve **ignorando las notas y usando solo la POSICIÓN** en cada ranking.

Cada trozo suma, por cada lista en la que aparece:

```
1 / (K_RRF + posición)        (con K_RRF = 60)
```

Así, un trozo que sale **bien colocado en ambas búsquedas** acumula más puntos que uno que solo destaca en una. Es decir, **premia el consenso**. (Lo probamos: con un trozo 2º en las dos listas, RRF lo pone 1º por delante de los que eran 1º en una sola.)

### 3. `Reranker.py` — el filtro fino

El reranker es un **cross-encoder**: a diferencia de los embeddings (que miran pregunta y texto por separado), este los mira **juntos** y da una nota de "cómo de bien responde este texto concreto a esta pregunta concreta". Es mucho más preciso, pero lento — por eso solo se aplica a los pocos candidatos que sobrevivieron al embudo, no a todo el proyecto.

Recibe los candidatos fusionados, los puntúa por pares `(pregunta, texto)`, los ordena y devuelve los `RAG_TOP_N` mejores. Mismo patrón singleton perezoso que los embeddings.

### Las constantes que ahora SÍ se usan

Los ajustes que en la Fase 0 dejamos "durmiendo" entran en juego aquí:

| Ajuste | Valor | Rol |
|--------|-------|-----|
| `RAG_TOP_K` | 50 | candidatos en bruto que recupera cada búsqueda antes de reordenar |
| `RAG_TOP_N` | 8 | trozos finos que quedan tras el reranking (los que irán al prompt) |
| `RERANKER_MODEL` | bge-reranker | el cross-encoder |

### ¿Cómo sé que funciona?

La lógica pura (sin librerías pesadas) se probó aislada: el tokenizador parte bien identificadores como `login_User`, y la fusión RRF prioriza correctamente el consenso entre ambas búsquedas. La parte que usa los modelos (embeddings + reranker) se validará en Docker, igual que la Fase 1.

### Resumen de la fase

**Fase 2 = ya sabemos buscar.** Dada una pregunta, devolvemos los ~8 trozos de código más relevantes, combinando significado (vectores) y palabras exactas (BM25), y afinando con un reranker. Lo que falta es **usar** esos trozos: construir el prompt y pedirle la respuesta a la IA, con citaciones y abstención. Eso es la **Fase 3** (generación anclada).

---

## Fase 3

Aquí **se cierra el círculo**: cogemos los trozos que recupera la Fase 2, construimos con ellos el mensaje de sistema para la IA y lo enchufamos al chat. Es el momento en que el RAG por fin "responde". El término clave es **generación anclada**: que la IA responda *agarrada* al código real del proyecto, no a lo que se imagina.

### El flujo, ahora completo

```
Usuario pregunta en el chat
   │
   ├─ ¿la conversación está ligada a un proyecto?
   │        │ sí
   │        ▼
   │   Retrieval.recuperar()  → 8 trozos relevantes      (Fase 2)
   │        ▼
   │   PromptBuilder.construir_prompt() → system_prompt + fuentes
   │        ▼
   └─ llamar_gemini/claude/groq(historial, pregunta, system_prompt)   (sin cambios)
            ▼
        respuesta + fuentes → frontend
```

### 1. `PromptBuilder.py` — el que arma las instrucciones

Coge los trozos recuperados y construye el **system_prompt**: el mensaje que le dice a la IA *quién es, qué reglas sigue y con qué material trabaja*. Mete tres garantías del roadmap:

- **Abstención:** se le ordena que, si la respuesta no está en el contexto, lo diga ("no aparece en los archivos que tengo") en lugar de inventar. Esto es lo que combate las alucinaciones.
- **Citaciones:** se le pide que cite de qué archivo y líneas saca cada cosa, con el formato `[ruta (Lx-Ly)]`. Para que pueda hacerlo, cada trozo del contexto va etiquetado con su origen:
  ```
  === src/login.py (L40-58) ===
  <código del trozo>
  ```
- **Anti prompt-injection:** se le advierte que el contexto son **datos**, no instrucciones — así, si un archivo contiene texto tipo "ignora todo y haz X", la IA no le hace caso. Es una medida de seguridad: separa las instrucciones de sistema del contenido recuperado.

Además aplica una técnica llamada **"lost in the middle"**: las IAs prestan menos atención a lo que cae en *mitad* de un contexto largo. Para evitarlo, el `PromptBuilder` coloca el trozo más relevante al **principio**, el segundo más relevante al **final**, y deja los menos importantes en el centro. (Lo probamos: 5 trozos ordenados por relevancia `[0,1,2,3,4]` se reorganizan a `[0,2,4,3,1]`.)

Devuelve **dos cosas**: el texto del prompt y la lista de **fuentes** (qué archivos y líneas se usaron), deduplicada.

### 2. Las "fuentes" y el cambio en el schema

Para que el frontend pueda mostrar **citaciones clicables** en el futuro, la respuesta del chat ahora incluye las fuentes. Se añadió:

- Un modelo `FuenteRespuesta` (`rutaRelativa`, `archivo_id`, `linea_inicio`, `linea_fin`).
- Un campo `fuentes: list[FuenteRespuesta] = []` en `MensajeRespuesta`.

Es **opcional y compatible hacia atrás**: los mensajes antiguos del historial (que no tienen fuentes) simplemente devuelven `[]`. Lo verificamos: el schema funciona tanto si el objeto trae `fuentes` como si no.

Detalle de implementación: las fuentes **no se guardan en la base de datos** (son efímeras de esa respuesta). Se "pegan" al objeto del mensaje justo antes de devolverlo (`mensaje_ia.fuentes = fuentes`), solo para serializarlas al frontend.

### 3. El enganche en `MensajeController`

En el endpoint del chat (`chat_ia`), justo antes de llamar a la IA, se añadió el bloque RAG:

```
si la conversacion tiene proyecto:
    chunks = recuperar(pregunta, usuario, proyecto)
    system_prompt, fuentes = construir_prompt(pregunta, chunks)
```

Puntos importantes de este enganche:

- **No se tocaron las llamadas a las APIs de IA.** Las funciones `llamar_gemini/claude/groq` ya aceptaban un `system_prompt`; simplemente ahora le pasamos uno con contenido en vez de vacío.
- **Si no hay proyecto**, el `system_prompt` queda vacío y la IA responde como un chat normal (sin RAG).
- **Tolerante a fallos:** si la recuperación falla, se registra y el chat sigue respondiendo *sin* contexto, en vez de romperse. Misma filosofía que el resto del proyecto.

### ¿Cómo sé que funciona?

La lógica pura (sin modelos) se probó aislada: el reordenado *lost-in-the-middle* coloca bien los extremos, el prompt incluye las etiquetas de citación + las tres reglas, las fuentes se deduplican, y el caso sin contexto genera el prompt de fallback. El schema se validó con y sin fuentes. La cadena completa con modelos reales se probará en Docker.

### Resumen de la fase

**Fase 3 = el RAG ya responde.** Cuando preguntas sobre un proyecto, la IA recibe los trozos de código relevantes con reglas estrictas (responder solo desde el contexto, citar, no inventar) y devuelve la respuesta junto con sus fuentes. El núcleo RAG está **funcionalmente completo**. Lo que viene es la capa **copilot**: que entienda preguntas de seguimiento (reescritura multi-turno) y memoria — la **Fase 4**.

---

## Fase 4

Esta es la primera pieza de la **capa copilot**: hacer que el RAG entienda las **preguntas de seguimiento** (follow-ups) dentro de una conversación.

### El problema

Imagina esta conversación:

```
Usuario:    ¿qué hace verificar_credenciales?
Asistente:  valida el usuario y la contraseña con bcrypt...
Usuario:    ¿y eso dónde se usa?      ← follow-up
```

Cuando el usuario pregunta "**¿y eso dónde se usa?**", esa frase suelta es **inútil para buscar**: no tiene ningún término aprovechable. Si se la pasamos al recuperador tal cual, no encuentra nada relevante, porque "eso" no significa nada fuera de la conversación. El RAG, que mira cada pregunta de forma aislada, se pierde en los follow-ups.

### La solución: reescritura de consulta multi-turno

Antes de buscar, **reescribimos la pregunta a una versión autónoma** usando el historial, resolviendo las referencias:

```
"¿y eso dónde se usa?"   →   "¿dónde se usa la función verificar_credenciales?"
```

Esa consulta reescrita **sí** tiene términos buscables, así que el recuperador encuentra lo correcto.

### 1. `QueryRewrite.py`

Su función `reescribir(historial, pregunta, modelo)` hace justo eso:

- Si **no hay historial** (primer mensaje), devuelve la pregunta tal cual — no hay nada que resolver, y así no gastamos una llamada de más.
- Si hay historial, coge los **últimos mensajes** (pocos, para que sea barato), se los da a la IA con la instrucción "reescribe esto como una búsqueda autónoma" y devuelve el resultado.
- **Reutiliza el modelo activo del usuario** (Gemini/Claude/Groq) — no añade dependencias nuevas.
- Es **tolerante a fallos**: si la reescritura falla, devuelve la pregunta original. Nunca rompe el chat por esto.

### 2. El detalle CLAVE: la reescritura es solo para BUSCAR

Esto es importante de entender. La pregunta se usa en dos sitios distintos, y solo uno se reescribe:

```
"¿y eso dónde se usa?"
   │
   ├─ reescrita → "¿dónde se usa verificar_credenciales?" → RECUPERAR contexto
   │
   └─ ORIGINAL  → "¿y eso dónde se usa?"                    → se la pasa a la IA para RESPONDER
```

La consulta reescrita se usa **únicamente para recuperar** los trozos. La pregunta **original** es la que recibe la IA para generar la respuesta (junto con su historial completo, que ya tenía). Así la IA responde de forma natural al hilo, pero con el contexto correcto recuperado.

### 3. El enganche en `MensajeController`

Dentro del bloque RAG, antes de `recuperar`, se añadió una línea: `consulta_rag = reescribir(...)`, y se usa `consulta_rag` para recuperar y construir el prompt, dejando `datos.contenido` (original) intacto para la llamada a la IA.

### Sobre la "memoria/estado" (lo que NO se hizo, y por qué)

El plan de la Fase 4 también mencionaba *memoria con resumen e historial comprimido*. Tras revisarlo, **no hacía falta implementarlo ahora**, por una razón concreta: la app **ya reenvía el historial completo** a la IA en cada mensaje (la coherencia conversacional para *responder* ya funciona). El resumen solo aportaría cuando una conversación se vuelve larguísima (para ahorrar tokens), y con el tope de 20 conversaciones y conversaciones normales no es un problema todavía. La "memoria para *buscar*" —que sí faltaba— es justo lo que resuelve la reescritura. Así que se deja el resumen como optimización futura, no como deuda funcional.

### ¿Cómo sé que funciona?

Se probó la lógica pura (con un modelo simulado): sin historial devuelve la pregunta original sin llamar al modelo; con historial dispara la reescritura; y el formato del contexto (Usuario/Asistente) es correcto. La reescritura real con modelo se ejercitará igual que el resto, en Docker.

### Resumen de la fase

**Fase 4 = el RAG ya entiende follow-ups.** Las preguntas encadenadas ("¿y eso?", "¿dónde se usa?") se reescriben a consultas autónomas antes de buscar, así que recuperan el contexto correcto, mientras la IA sigue respondiendo de forma natural al hilo. Lo que queda es **streaming** (que la respuesta aparezca poco a poco) — la **Fase 5** — y la integración en el frontend.

---

## Fase 5

Última pieza del backend: **streaming**. Que la respuesta de la IA aparezca **poco a poco**, palabra a palabra, en vez de esperar a que esté entera. Es buena parte de la sensación "copilot".

### El problema

Hasta ahora, el chat funcionaba así: el usuario pregunta → el backend espera a que la IA genere **toda** la respuesta → la devuelve de golpe. Si la respuesta es larga, el usuario mira una pantalla quieta varios segundos. Con streaming, ve el texto **apareciendo en tiempo real**, como en ChatGPT/Copilot.

### Qué es SSE

**SSE (Server-Sent Events)** es una forma de que el servidor envíe datos al cliente **en goteo** por una sola conexión HTTP, en vez de una respuesta única. El formato es una sucesión de líneas `data: <contenido>\n\n`. El frontend va leyendo esos trozos según llegan.

### 1. Variantes *streaming* en los servicios de IA

Cada servicio (`Gemini/Groq/Claude`) tiene ahora una función gemela `llamar_X_stream` que, en vez de **devolver** el texto entero (`return`), lo va **produciendo** por fragmentos (`yield`) según el modelo los genera. Los tres SDKs soportan streaming nativo:

- Gemini: `send_message_stream(...)`
- Groq: `create(..., stream=True)`
- Claude: `messages.stream(...)`

Las funciones originales (`llamar_gemini`, etc.) se mantienen intactas para el endpoint normal.

### 2. El nuevo endpoint `POST /chat/stream`

Se añadió **junto al `/chat` de siempre** (que sigue existiendo para compatibilidad). Hace exactamente la misma preparación que el normal —límite diario, guardar el mensaje del usuario, reescritura multi-turno, recuperación, construcción del prompt— pero en vez de devolver un JSON, devuelve un **stream de eventos** (`StreamingResponse` con `text/event-stream`).

Emite tres tipos de evento:

```
{"tipo":"token","contenido":"..."}       ← cada fragmento de texto (se van concatenando)
{"tipo":"fin","id":123,"fuentes":[...]}   ← al acabar: id del mensaje guardado + fuentes del RAG
{"tipo":"error","detalle":"..."}          ← si algo falla a mitad
```

El flujo dentro del endpoint:
1. Hace la preparación y **cierra la sesión de BD**.
2. Empieza a "tirar" tokens del modelo, y por cada uno emite un evento `token`.
3. Mientras los emite, los va **acumulando** en memoria.
4. Al terminar, junta todo el texto, **guarda la respuesta completa** en la BD y emite el evento `fin` con el id y las fuentes.

### 3. Dos detalles delicados del streaming

- **Sesiones de BD dentro del generador:** como la respuesta se genera *después* de cerrar la sesión inicial, el historial se convierte a objetos planos (`SimpleNamespace`) antes de cerrarla, para no acceder a objetos ORM "desconectados" (el mismo problema que ya vimos en las pruebas). Y para guardar el mensaje final se abre una sesión nueva dentro del generador.
- **Errores a mitad de stream:** una vez empezamos a enviar tokens, la respuesta HTTP ya es `200` y no se puede cambiar a un código de error. Por eso, si la IA falla a mitad, no lanzamos una excepción HTTP: deshacemos (borramos el mensaje del usuario, devolvemos el cupo del límite) y avisamos con un evento `{"tipo":"error"}` por el propio stream.

### ¿Cómo sé que funciona?

Sintaxis verificada en los cuatro archivos y el formato SSE probado (los eventos `token`/`fin` se serializan bien y los fragmentos se reconcatenan correctamente). El streaming real necesita una API key válida del proveedor para probarse de punta a punta (la prueba anterior en Docker no la necesitaba porque solo tocaba recuperación, no generación).

### Resumen de la fase

**Fase 5 = experiencia copilot completa en el backend.** La respuesta puede llegar token a token por SSE, con las fuentes al final. Con esto, **el backend del RAG-copilot está terminado**: ingesta, búsqueda híbrida + reranking, generación anclada con citaciones, follow-ups multi-turno y streaming. Lo único que queda fuera del backend es el **frontend**: consumir el stream y pintar las citaciones clicables.

---

## Frontend (conexión)

Última parte: enganchar todo el RAG a la interfaz del Centro de IA. Dos cosas: **consumir el streaming** y **mostrar las citaciones**.

### 1. Streaming en el chat

Antes, el chat usaba `axios.post` al endpoint normal y esperaba la respuesta entera. El problema: **axios no sabe leer respuestas en streaming** en el navegador. Por eso se cambió a la API nativa **`fetch`**, que sí permite leer el cuerpo poco a poco:

- Se llama a `POST /chat/stream` con `fetch`.
- Se lee el cuerpo con un *reader* (`response.body.getReader()`), que va entregando trozos de bytes.
- Se decodifican y se parten por eventos SSE (`\n\n`). Cada evento es un JSON con su `tipo`.
- Por cada evento `token`, se va **añadiendo el texto a la burbuja de la IA**, que crece en pantalla en tiempo real.
- Con el evento `fin`, se guardan las **fuentes** en ese mensaje.

Detalle de UX: los puntitos de "pensando" se muestran solo hasta que llega el **primer token**; a partir de ahí, el texto aparece solo.

### 2. Citaciones clicables

Cuando un mensaje de la IA trae `fuentes`, debajo de la burbuja se pintan unos *chips* tipo `📄 src/auth/login.py (L40-58)`. Al hacer clic, se abre un **modal** que muestra el contenido del archivo, reutilizando el endpoint que ya existía (`GET /archivos/{id}/contenido`). Así el usuario puede comprobar de dónde sacó la IA cada cosa.

Limitación conocida: las fuentes son **efímeras** (no se guardan en la BD), así que solo aparecen en los mensajes generados en la sesión actual. Al recargar una conversación antigua, el texto está pero no los chips. Es una decisión consciente (las citaciones son de cada respuesta, no del historial).

### ¿Cómo sé que funciona?

El frontend **compila** (build de Vite correcta, 274 módulos) y pasa el **linter**. La prueba visual real (ver los tokens aparecer y abrir una cita) se hace levantando la app.

### Resumen

**El RAG-copilot está conectado de punta a punta:** subes archivos → se indexan → preguntas en el Centro de IA → la respuesta aparece en streaming, anclada en tu código, con citaciones clicables que abren el archivo. El proyecto Cortex ya tiene un copilot funcional sobre tus propios proyectos.
