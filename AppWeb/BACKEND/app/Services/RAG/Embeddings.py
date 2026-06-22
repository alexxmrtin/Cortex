import json
import hashlib
from app.Core.config import settings
from app.Helpers.Cache import obtener_cache, guardar_cache
from app.Helpers.Log import log_info

# Wrapper del modelo de embeddings local (BGE-M3 via sentence-transformers).
#
# El modelo es PESADO (arrastra torch y descarga ~1-2 GB la primera vez), asi que:
#   - Se carga UNA sola vez y se reutiliza (singleton perezoso, igual que el cliente de Redis).
#   - La carga ocurre en el primer uso real, no al importar el modulo, para no ralentizar el arranque
#     ni romper la app si alguien solo importa este fichero.
#
# IMPORTANTE: hay que usar EL MISMO modelo para indexar documentos y para vectorizar consultas, de lo contrario los vectores no son comparables. Por eso ambas funciones de aqui usan _obtener_modelo().


# Cache del modelo a nivel de modulo. Empieza en None y se rellena en la primera llamada con el modelo embedding que tengamos en el .env
_modelo = None


def _obtener_modelo():
    global _modelo #Usamos global para que la variable _modelo obtenga el parametro que le vamos a poner a nivel de modulo, no solo en esta funcion localmente
    if _modelo is None:
        # Import perezoso: importar sentence_transformers/torch es lento, solo lo hacemos cuando de verdad se necesita
        from sentence_transformers import SentenceTransformer
        log_info(f"Cargando modelo de embeddings '{settings.EMBEDDING_MODEL}' (puede tardar la primera vez)")
        _modelo = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _modelo


# Transformamos un texto o array en un vector para luego trabajar con el e indexarlo
# normalize_embeddings=True deja los vectores con norma 1, necesario para que la distancia coseno funcione bien.
def embeder_documentos(textos: list[str]) -> list[list[float]]:
    if not textos:
        return []

    modelo = _obtener_modelo()
    vectores = modelo.encode(textos, normalize_embeddings=True)

    # encode devuelve un array de numpy; lo pasamos a listas de floats de Python (lo que espera Chroma y lo serializable a JSON)
    resultado = []
    for vector in vectores:
        resultado.append(vector.tolist())
    return resultado


# Vectoriza la consulta del usuario. Cacheamos el resultado en Redis porque la misma pregunta (o un follow-up identico) puede repetirse, y embeber es lo mas caro de cada consulta.
def embeder_consulta(texto: str) -> list[float]:
    # La clave incluye el nombre del modelo: si se cambia de modelo, los embeddings cacheados no se reutilizan por error
    huella = hashlib.sha256((settings.EMBEDDING_MODEL + "::" + texto).encode("utf-8")).hexdigest()
    clave = "rag:emb:" + huella

    cacheado = obtener_cache(clave)
    if cacheado is not None:
        return json.loads(cacheado)

    modelo = _obtener_modelo()
    vector = modelo.encode(texto, normalize_embeddings=True).tolist()

    # TTL de 1 hora: suficiente para reutilizar dentro de una sesion sin acumular claves indefinidamente
    guardar_cache(clave, json.dumps(vector), 3600)
    return vector
