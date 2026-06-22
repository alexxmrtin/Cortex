# Plan de implementación — RAG profesional para Cortex (Núcleo + Copilot)

## Contexto

El RAG anterior de Cortex era un simple emparejado por nombre de archivo (si la pregunta mencionaba `conversacioncontroller.py`, se inyectaba ese fichero). Ya se eliminó por completo (`MensajeController` ahora manda `system_prompt = ""`). Queremos reconstruirlo como un RAG de nivel producción tomando como referencia [RAG.md](RAG.md).

Particularidad clave de Cortex frente al roadmap genérico: **el corpus no son PDFs/webs, son archivos de código** de los proyectos que el usuario sube, ya almacenados en disco bajo `Storage/{usuario_id}/{proyecto_id}/` con metadatos en la tabla `ArchivosProyecto`. Eso condiciona el chunking (consciente de código) y el aislamiento por usuario/proyecto.

**Decisiones tomadas:**
- **Vector store:** Chroma embebido (persistente en disco, sin cambiar de BD ni levantar infra nueva).
- **Embeddings + reranker:** locales con `sentence-transformers` — BGE-M3 (embeddings, multilingüe) + `bge-reranker` (cross-encoder). Sin coste por API, privado.
- **Alcance de este plan:** Bloque 1 (núcleo profesional) **detallado** + Bloque 2 (capa copilot: reescritura multi-turno, memoria/estado, citaciones, streaming SSE). Evaluación/producción/frontend quedan **esbozados** como fases futuras.

**Objetivo:** que cuando una conversación esté ligada a un proyecto, la IA responda anclada en los fragmentos de código realmente relevantes (recuperación híbrida + reranking), con citaciones a fichero+líneas, abstención cuando no hay soporte, y experiencia copilot (follow-ups + streaming). Las llamadas a las APIs de IA (Gemini/Claude/Groq) y los endpoints REST existentes se mantienen compatibles con el frontend; el frontend se adaptará después.

---

## Arquitectura propuesta

Nuevo paquete `app/Services/RAG/` que encapsula todo el motor. El resto del backend solo lo invoca en dos puntos: al **subir/borrar archivos** (indexar) y al **chatear** (recuperar + generar).

```
Subida de archivo ─► Ingestion ─► Chunker ─► Embeddings ─► VectorStore(Chroma) + tabla ChunkArchivo(SQLite)
                                                              │
Chat ─► QueryRewrite ─► Retrieval (vector + BM25 → RRF) ─► Reranker ─► PromptBuilder ─► Service IA (Gemini/Claude/Groq)
```

- **Multitenancy / aislamiento:** una sola colección Chroma con filtrado por metadata `{usuario_id, proyecto_id}` en **toda** consulta (requisito de seguridad 3.2 del roadmap). Nadie recupera chunks de otro usuario.
- **BM25 (léxico):** el texto de cada chunk se guarda en una tabla SQLite nueva `ChunkArchivo`; el índice BM25 se construye en memoria por proyecto al consultar (con `rank-bm25`). Para los tamaños de un proyecto personal es suficiente.
- **Modelos locales:** se cargan **una sola vez** como singletons al arrancar (patrón perezoso, como el cliente Redis), no por petición.

---

## Fase 0 — Infraestructura y dependencias

- `requirements.txt`: añadir `chromadb`, `sentence-transformers`, `rank-bm25`. (Arrastra `torch`; documentar que la 1ª ejecución descarga ~1-2 GB de modelos.)
- `app/Core/config.py`: nuevas settings — `RAG_PERSIST_DIR` (carpeta Chroma, p. ej. `Storage/ChromaDB`), `EMBEDDING_MODEL` (`BAAI/bge-m3`), `RERANKER_MODEL` (`BAAI/bge-reranker-v2-m3`), `RAG_TOP_K` (50), `RAG_TOP_N` (8). Actualizar `.env.example` y el README.
- `app/Services/RAG/Embeddings.py`: wrapper singleton de `SentenceTransformer` para embeddings (encode de documentos y de consultas con el mismo modelo). Cachear embedding de consulta en Redis (reutiliza `app/Helpers/Cache.py`).
- `app/Services/RAG/VectorStore.py`: wrapper del `PersistentClient` de Chroma (una colección `chunks_codigo`), con `upsert`, `query(filtros)`, `delete(filtros)`.
- `app/Models/ChunkArchivo.py`: nueva tabla — `id`, `archivo_id` (FK), `proyecto_id`, `usuario_id`, `indice`, `texto`, `linea_inicio`, `linea_fin`, `lenguaje`. Sirve para BM25, citaciones y reindexado idempotente. Registrarla donde se crean las tablas al arrancar.
- **Implicación Docker:** los modelos hay que descargarlos en el `build` (o cachear el volumen de HuggingFace) para que el contenedor no los baje en cada arranque. Dejar nota en el Dockerfile/README.

## Fase 1 — Ingesta + chunking (consciente de código) + embeddings

- `app/Services/RAG/Chunker.py`: _recursive splitting_ respetando estructura del código (separadores por dobles saltos/bloques → líneas), objetivo ~300-700 tokens con ~15 % de solapamiento. Cada chunk conserva `linea_inicio`/`linea_fin` (para citaciones) y `lenguaje` (deducido de la extensión). _Parent-document_: el "padre" es el fichero completo (se puede entregar como contexto ampliado si un chunk encaja). Tree-sitter por función queda como mejora futura.
- `app/Services/RAG/Ingestion.py`: dado un `ArchivosProyecto`, lee el fichero de `rutaDisco`, lo trocea, embebe los chunks y hace **upsert** en Chroma + filas en `ChunkArchivo`. **Idempotente:** IDs deterministas `f"{archivo_id}:{indice}"` y borrado previo de los chunks de ese `archivo_id` antes de reinsertar (re-ingesta sin duplicar, 1.1 del roadmap).
- Enganches en `app/Controllers/ArchivoProyectoController.py`:
  - `subir_archivo` (POST) → tras guardar en disco/BD, indexar el archivo.
  - `eliminar_archivo` (DELETE) → borrar sus chunks de Chroma y `ChunkArchivo`.
  - Borrado de proyecto (`ProyectoController`) → borrar todos los vectores/chunks del proyecto (evitar vectores huérfanos, frescura 5.6).
- `POST /proyectos/{id}/reindexar` (o script `reindex.py`): indexar proyectos ya subidos antes de existir el RAG. Útil también para reconstruir el índice.
- *(Opcional, gran palanca de recall — 1.3):* **contextual retrieval**, anteponer a cada chunk un breve contexto generado por LLM antes de embeber. Añade coste de indexado; lo dejamos como flag desactivable.

## Fase 2 — Recuperación profesional (el corazón de la calidad)

- `app/Services/RAG/Retrieval.py`:
  - **Vectorial:** `VectorStore.query` top-k (~50) filtrando por `usuario_id` + `proyecto_id`.
  - **Léxica BM25:** cargar los `ChunkArchivo` del proyecto, construir `BM25Okapi` y puntuar la consulta (imprescindible para nombres exactos, siglas, identificadores que el vectorial se salta — 1.6).
  - **Fusión RRF:** combinar ambos rankings con Reciprocal Rank Fusion.
- `app/Services/RAG/Reranker.py`: cross-encoder `bge-reranker` que reordena el top-k fusionado a **top-n (~8)** (mayor salto de calidad por esfuerzo). Singleton.
- Salida: lista ordenada de chunks con su metadata (fichero, líneas) lista para citar.

## Fase 3 — Generación anclada (respuesta con citaciones y abstención)

- `app/Services/RAG/PromptBuilder.py`: construye el `system_prompt` con:
  - Reglas: **responder solo desde el contexto**, **abstenerse ("no aparece en los archivos") si no hay soporte**, tono, idioma del usuario (1.7, 3.1).
  - Bloques de contexto etiquetados con su fuente `=== rutaRelativa (L{inicio}-{fin}) ===` para permitir citaciones.
  - Mitigación _lost-in-the-middle_: lo más relevante al principio y al final.
  - Anti _prompt-injection_ (3.2): marcar el contenido recuperado como datos no ejecutables, separado de las instrucciones de sistema.
- `app/Controllers/MensajeController.py`: en el chat, si `conversacion.proyecto_id`, llamar a Retrieval → PromptBuilder y pasar el `system_prompt` resultante a `llamar_gemini/claude/groq` (las firmas ya aceptan `system_prompt`; **no se tocan las llamadas a las APIs**). Devolver junto al mensaje las **fuentes** usadas (lista de `{rutaRelativa, archivo_id, lineas}`) para citaciones — requiere extender `MensajeSchema.MensajeRespuesta` con un campo `fuentes` opcional (compatible hacia atrás; el frontend lo usará después).

## Fase 4 — Capa copilot: memoria, estado y reescritura multi-turno

- `app/Services/RAG/QueryRewrite.py`: antes de recuperar, reescribir la pregunta a una **consulta autónoma** usando el historial (resuelve follow-ups tipo "¿y en este otro caso?" — 2.1). Usar un **modelo barato** (Gemini Flash o Groq) para no encarecer; cachear.
- **Memoria/estado:** resumen incremental del historial cuando se hace largo + _slots_ (datos que el usuario ya dio) guardados en la conversación, para no re-preguntar ni reenviar todo el historial crudo cada vez (2.1). Reutiliza la persistencia de `Conversacion`/`Mensaje`.

## Fase 5 — Streaming SSE (backend)

- Nuevo endpoint `POST /mensajes/conversacion/{id}/chat/stream` (o variante con `StreamingResponse` + SSE) que emite la respuesta token a token (2.4). Añadir variantes _streaming_ en los services de IA (los SDKs de Gemini/Groq/Claude lo soportan). Se mantiene el endpoint no-streaming actual para compatibilidad. El consumo en el frontend (EventSource) queda para la fase de frontend.

## Fases futuras (esbozadas — no se implementan ahora)

- **Evaluación (Bloque 4):** golden set de 100-200 preguntas reales sobre proyectos de ejemplo + métricas (recall@k, MRR, faithfulness) con RAGAS/DeepEval; _regression gate_ en CI antes de tocar chunking/modelo/prompt.
- **Guardarraíles y seguridad (Bloque 3):** moderación E/S, refuerzo anti prompt-injection, PII.
- **Producción (Bloque 5):** observabilidad/tracing (Langfuse/Phoenix), _semantic cache_, reindexado incremental programado, monitorización de coste por conversación.
- **Frontend copilot (Bloque 6):** consumir SSE, citaciones clicables (mapear `fuentes` → preview del archivo, reutilizando `GET /archivos/{id}/contenido`), chips de seguimiento, feedback 👍/👎.

---

## Archivos clave a crear / modificar

**Nuevos:**
- `app/Services/RAG/` → `Embeddings.py`, `VectorStore.py`, `Chunker.py`, `Ingestion.py`, `Retrieval.py`, `Reranker.py`, `PromptBuilder.py`, `QueryRewrite.py`
- `app/Models/ChunkArchivo.py`
- Script/endpoint de reindexado

**Modificados:**
- `requirements.txt`, `app/Core/config.py`, `.env.example`, `README.md`
- `app/Controllers/ArchivoProyectoController.py` (indexar al subir / borrar)
- `app/Controllers/ProyectoController.py` (limpiar índice al borrar proyecto)
- `app/Controllers/MensajeController.py` (recuperar + generar + streaming)
- `app/Schemas/MensajeSchema.py` (campo `fuentes`)
- Punto de creación de tablas al arrancar (registrar `ChunkArchivo`)
- Dockerfile (cachear modelos)

**Reutilización (no reinventar):**
- `app/Helpers/Cache.py` (Redis) para cache de embeddings de consulta y resultados.
- `app/Helpers/Log.py` (`log_info`/`log_error`) para trazar recuperación e indexado.
- Firmas existentes `llamar_gemini/claude/groq(historial, mensaje, system_prompt)` — se aprovechan tal cual.
- `GET /archivos/{id}/contenido` para las citaciones clicables (frontend, futuro).

**Estilo:** seguir el código existente; nada de operadores ternarios, siempre `if/else` completo.

---

## Verificación (end-to-end)

1. **Indexado:** subir un proyecto pequeño (varios `.py`/`.js` + README); comprobar que se crean filas en `ChunkArchivo` y vectores en Chroma (log de nº de chunks por archivo). Re-subir el mismo archivo y verificar que **no duplica** (idempotencia).
2. **Aislamiento:** con dos usuarios, confirmar que una consulta de uno **nunca** recupera chunks del otro (filtro de metadata).
3. **Recuperación:** preguntar por una función concreta por su nombre exacto y verificar que BM25 la recupera aunque el vectorial no; revisar el orden tras el reranking en logs.
4. **Generación anclada:** pregunta respondible → la respuesta cita `fichero (Lx-Ly)` correctos. Pregunta sobre algo que **no** está en el proyecto → la IA **se abstiene** en vez de inventar.
5. **Copilot:** hacer un follow-up ("¿y eso dónde se usa?") y comprobar que la reescritura de consulta recupera bien sin repetir contexto.
6. **Streaming:** llamar al endpoint SSE y ver la respuesta llegando por tokens.
7. **Borrado/frescura:** borrar un archivo y un proyecto y confirmar que desaparecen sus vectores y filas de `ChunkArchivo` (sin huérfanos).
