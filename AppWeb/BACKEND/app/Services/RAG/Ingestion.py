from app.Core.database import SessionLocal
from app.Models.ChunkArchivo import ChunkArchivo
from app.Models.ArchivosProyecto import ArchivosProyecto
from app.Services.RAG import VectorStore
from app.Services.RAG.Embeddings import embeder_documentos
from app.Services.RAG.Chunker import partir
from app.Helpers.Log import log_info, log_error

# Orquestador de la INGESTA del RAG.(Lee contenido del disco,llama a Chunker.py,llama a Embedding.py usando los chunks y guarda los vectores (embeddings) en ChromaDB)

# Es la unica pieza que toca a la vez el Chunker, los Embeddings, Chroma (VectorStore) y la tabla ChunkArchivo. Los controladores solo llaman a estas funciones; no manipulan chunks ni vectores.

# Indexar un archivo es: leerlo -> trocearlo -> vectorizar los trozos -> guardar vectores en Chroma y texto+metadatos en ChunkArchivo. Es IDEMPOTENTE: antes de indexar se borra lo viejo del archivo, asi reindexar o re-subir no duplica.



# Borra todo rastro de un archivo en el indice: vectores en Chroma y filas en ChunkArchivo.
def _limpiar(archivo_id: int):
    VectorStore.borrar_por_archivo(archivo_id)
    db = SessionLocal()
    try:
        db.query(ChunkArchivo).filter(ChunkArchivo.archivo_id == archivo_id).delete()
        db.commit()
    finally:
        db.close()


# Indexa un archivo. Recibe valores primitivos (no el objeto ORM) para no depender de la sesion del controlador. Nunca lanza excepcion: un fallo de indexado se registra pero NO debe tumbar la subida. Devuelve cuantos chunks se indexaron.
def indexar_archivo(archivo_id: int, proyecto_id: int, usuario_id: int, ruta_relativa: str, ruta_disco: str) -> int:
    try:
        # 1. Leer el archivo. Si es binario o ilegible, lo quitamos del indice (por si tenia algo viejo) y salimos.
        try:
            with open(ruta_disco, "r", encoding="utf-8") as f:
                contenido = f.read()
        except (UnicodeDecodeError, FileNotFoundError, OSError):
            _limpiar(archivo_id)
            return 0

        # 2. Trocear.
        chunks = partir(contenido, ruta_relativa)

        # 3. Idempotencia: borrar siempre lo viejo del archivo. Si quieres actualizar un archivo, borras de ChromaDB todo lo relacionado con el archivo y metes los nuevos chunks del archivo. 
        _limpiar(archivo_id)

        if not chunks:
            return 0

        # 4. Vectorizar todos los trozos de golpe.
        textos = [c["texto"] for c in chunks]
        vectores = embeder_documentos(textos)

        # 5. Guardar: guardamos en Postgre informacion del chunk en la tabla ChunkArchivo y posteriormente guardamos en ChromaDB el chunk vectorizado 
        ids = []
        metadatas = []
        db = SessionLocal()
        try:
            for c in chunks:
                ids.append(f"{archivo_id}:{c['indice']}")

                # Chroma no admite None en metadata: si no se detecto lenguaje, ponemos "desconocido".
                lenguaje_meta = c["lenguaje"]
                if lenguaje_meta is None:
                    lenguaje_meta = "desconocido"

                #Metadatos que vamos a meter en ChromaDB como informacion extra del embedding(chunk vectorizado)
                metadatas.append({
                    "usuario_id": usuario_id,
                    "proyecto_id": proyecto_id,
                    "archivo_id": archivo_id,
                    "rutaRelativa": ruta_relativa,
                    "indice": c["indice"],
                    "linea_inicio": c["linea_inicio"],
                    "linea_fin": c["linea_fin"],
                    "lenguaje": lenguaje_meta,
                })

                db.add(ChunkArchivo(
                    archivo_id=archivo_id,
                    proyecto_id=proyecto_id,
                    usuario_id=usuario_id,
                    indice=c["indice"],
                    texto=c["texto"],
                    linea_inicio=c["linea_inicio"],
                    linea_fin=c["linea_fin"],
                    lenguaje=c["lenguaje"],
                ))
            db.commit()
        finally:
            db.close()

        #Esto es el "insert" en ChromaDB, La estructura que va a guardar es algo tal que:

        # VectorStore.upsert(ids,vectores,textos,metadatas)
        #                     │     │         │       └─ metadata
        #                     │     │         └────────── el texto del chunk,en Chroma "documents"
        #                     │     └──────────────────── embeddings: el vector
        #                     └────────────────────────── ids: "archivo_id:indice"
        VectorStore.upsert(ids, vectores, textos, metadatas)


        log_info(f"Indexado archivo {archivo_id} ({ruta_relativa}): {len(chunks)} chunks")
        return len(chunks)

    except Exception as e:
        log_error(f"Fallo al indexar el archivo {archivo_id} ({ruta_relativa})", e)
        return 0


# Para el hook de borrado de archivo: las filas de ChunkArchivo se borran solas por el cascade del
# modelo al eliminar el ArchivosProyecto, asi que aqui solo hay que quitar los vectores de Chroma.
def borrar_archivo(archivo_id: int):
    VectorStore.borrar_por_archivo(archivo_id)


# Para el hook de borrado de proyecto: quita todos los vectores del proyecto (las filas de ChunkArchivo
# las borra el cascade al eliminar los archivos). Evita vectores huerfanos.
def borrar_proyecto(proyecto_id: int):
    VectorStore.borrar_por_proyecto(proyecto_id)


# Reindexa todos los archivos de un proyecto (util para proyectos subidos antes de existir el RAG,
# o para reconstruir el indice). Devuelve el total de chunks indexados.
def reindexar_proyecto(proyecto_id: int, usuario_id: int) -> int:
    db = SessionLocal()
    try:
        archivos = db.query(ArchivosProyecto).filter(ArchivosProyecto.proyecto_id == proyecto_id).all()
        # Capturamos los valores antes de cerrar la sesion para no acceder a atributos ORM "desconectados".
        datos = []
        for a in archivos:
            datos.append((a.id, a.proyecto_id, a.rutaRelativa, a.rutaDisco))
    finally:
        db.close()

    total = 0
    for (archivo_id, pid, ruta_relativa, ruta_disco) in datos:
        total += indexar_archivo(archivo_id, pid, usuario_id, ruta_relativa, ruta_disco)
    return total
