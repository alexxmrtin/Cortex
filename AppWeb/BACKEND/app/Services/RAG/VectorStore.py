from app.Core.config import settings
from app.Helpers.Log import log_info

# Wrapper de la base vectorial Chroma.

# Toda la app comparte UNA sola coleccion ("chunks_codigo"). El aislamiento entre usuarios y proyectos NO se hace con colecciones separadas, sino filtrando por metadata (usuario_id, proyecto_id) en cada consulta. Asi una sola coleccion sirve a todos y el filtro de seguridad va siempre en la propia query.

# El cliente y la coleccion se crean UNA vez (singleton perezoso), porque abrir el PersistentClient crea/abre ficheros en disco y no queremos pagarlo en cada peticion.

NOMBRE_COLECCION = "chunks_codigo"

_coleccion = None


def _obtener_coleccion():
    global _coleccion
    if _coleccion is None:
        # Import perezoso para no cargar chromadb al importar el modulo
        import chromadb
        log_info(f"Abriendo base vectorial Chroma en '{settings.RAG_PERSIST_DIR}'")
        cliente = chromadb.PersistentClient(path=settings.RAG_PERSIST_DIR)
        # hnsw:space=cosine -> usa distancia coseno, coherente con los embeddings normalizados de Embeddings.py
        _coleccion = cliente.get_or_create_collection(
            name=NOMBRE_COLECCION,
            metadata={"hnsw:space": "cosine"}
        )
    return _coleccion


# Construye el filtro de metadata de Chroma para acotar a un usuario y (opcionalmente) un proyecto. Chroma exige envolver varias condiciones en "$and".
def _filtro(usuario_id: int, proyecto_id: int = None) -> dict:
    condiciones = [{"usuario_id": usuario_id}]
    if proyecto_id is not None:
        condiciones.append({"proyecto_id": proyecto_id})

    if len(condiciones) == 1:
        return condiciones[0]
    return {"$and": condiciones}


# Inserta o actualiza chunks. Los ids son deterministas ("archivo_id:indice"), asi que reinsertar el mismo chunk lo sobreescribe en vez de duplicarlo (indexado idempotente).
def upsert(ids: list[str], embeddings: list[list[float]], documentos: list[str], metadatas: list[dict]):
    if not ids:
        return
    coleccion = _obtener_coleccion()
    coleccion.upsert(ids=ids, embeddings=embeddings, documents=documentos, metadatas=metadatas)


# Busca los n chunks mas parecidos al embedding de la consulta, SIEMPRE acotando por usuario (y proyecto).
# Devuelve el resultado crudo de Chroma (ids, documents, metadatas, distances).
def consultar(embedding_consulta: list[float], n_resultados: int, usuario_id: int, proyecto_id: int = None):
    coleccion = _obtener_coleccion()
    return coleccion.query(
        query_embeddings=[embedding_consulta],
        n_results=n_resultados,
        where=_filtro(usuario_id, proyecto_id)
    )


# Borra todos los chunks de un archivo concreto (al re-subirlo o eliminarlo).
def borrar_por_archivo(archivo_id: int):
    coleccion = _obtener_coleccion()
    coleccion.delete(where={"archivo_id": archivo_id})


# Borra todos los chunks de un proyecto (al eliminar el proyecto), evitando vectores huerfanos.
def borrar_por_proyecto(proyecto_id: int):
    coleccion = _obtener_coleccion()
    coleccion.delete(where={"proyecto_id": proyecto_id})
