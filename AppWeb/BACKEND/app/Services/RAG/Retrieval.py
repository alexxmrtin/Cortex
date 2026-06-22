import re
from app.Core.config import settings
from app.Core.database import SessionLocal
from app.Models.ChunkArchivo import ChunkArchivo
from app.Models.ArchivosProyecto import ArchivosProyecto
from app.Services.RAG.Embeddings import embeder_consulta
from app.Services.RAG import VectorStore
from app.Services.RAG.Reranker import reordenar
from app.Helpers.Log import log_error

# Orquestador de la RECUPERACION del RAG (el corazon de la calidad).

# Dada una pregunta y el proyecto del usuario, devuelve los trozos de codigo mas relevantes. El proceso
# combina DOS busquedas y luego afina con un reranker (embudo: muchos candidatos baratos -> pocos finos):
#
#   1. SEMANTICA (vectorial, Chroma): entiende el "significado" de la pregunta. Buena para parafrasis,
#      pero se salta nombres exactos / identificadores raros.
#   2. LEXICA (BM25): busca por palabras/identificadores exactos. Recupera lo que la semantica ignora.
#   3. FUSION RRF: combina ambos rankings en uno solo (Reciprocal Rank Fusion).
#   4. RERANKING: un cross-encoder reordena los candidatos fusionados y deja los TOP_N mejores.


# Constante del RRF. Suaviza el peso de las primeras posiciones; 60 es el valor habitual en la literatura.
K_RRF = 60


# Tokenizador simple para BM25: pasa a minusculas y parte por palabras/identificadores (letras, numeros, _).
def _tokenizar(texto: str) -> list[str]:
    return re.findall(r"[a-zA-Z0-9_]+", texto.lower())


# Reciprocal Rank Fusion: recibe varias listas de claves ya ordenadas  y devuelve UNA lista fusionada. 
# Funcionamiento: Tienes dos listas ordenadas, una vectorial y otra lexica, para combinar las dos listas, como estan en escalas diferentes usamos la posicion que ocupa cada elemento en la lista. Cada elemento recibe una puntuacion segun donde esten, si aparecen en ambas listas sumamos esa puntuacion, si aparece en una, ponemos la puntuacion conseguida en una unica lista como total.(Es un poco dificil, lo tienes en obsidian mas claro)
def _fusionar_rrf(rankings: list[list[str]]) -> list[str]:
    puntuacion = {}
    for ranking in rankings:
        for posicion, clave in enumerate(ranking):
            if clave not in puntuacion:
                puntuacion[clave] = 0.0
            puntuacion[clave] += 1.0 / (K_RRF + posicion + 1)  # +1 porque posicion empieza en 0

    claves_ordenadas = sorted(puntuacion.keys(), key=lambda c: puntuacion[c], reverse=True)
    return claves_ordenadas


# Funcion principal: devuelve hasta RAG_TOP_N (lo tengo puesto a 50 en el .env) trozos relevantes a la consulta, como lista de dicts: {texto, rutaRelativa, archivo_id, linea_inicio, linea_fin, lenguaje}
def recuperar(consulta: str, usuario_id: int, proyecto_id: int) -> list[dict]:
    db = SessionLocal()
    
    try:
        # 1. Cargamos TODOS los chunks del proyecto (texto + metadata), uniendo con ArchivosProyecto para
        #    obtener la rutaRelativa (que ChunkArchivo no guarda). Esto sirve a la vez como corpus de BM25
        #    y como "fuente de la verdad" de cada candidato.
        filas = (
            db.query(ChunkArchivo, ArchivosProyecto.rutaRelativa)
            .join(ArchivosProyecto, ChunkArchivo.archivo_id == ArchivosProyecto.id)
            .filter(ChunkArchivo.proyecto_id == proyecto_id, ChunkArchivo.usuario_id == usuario_id)
            .all()
        )
    finally:
        db.close()

    # Si el proyecto no tiene nada indexado, no hay nada que recuperar.
    if not filas:
        return []


    # Construimos un indice por clave "archivo_id:indice" 
    info_por_clave = {}   # "archivo_id:indice" -> datos completos del chunk (texto + metadata). dado una clave "5:0" devolvemos todo el chunk

    #Construimos array para usar en BM25 (buscador lexico)
    claves_corpus = [] # lista de claves "archivo_id:indice" en orden. Traduce la posicion i del corpus BM25 a su clave
    corpus_tokens = []  # lista de textos ya tokenizados, en el mismo orden que claves_corpus. Es el corpus que indexa la busqueda lexica


    #En este for rellenamos las tres estructuras anteriores
    for (chunk, ruta_relativa) in filas:
        clave = f"{chunk.archivo_id}:{chunk.indice}"
        info_por_clave[clave] = {
            "texto": chunk.texto,
            "rutaRelativa": ruta_relativa,
            "archivo_id": chunk.archivo_id,
            "linea_inicio": chunk.linea_inicio,
            "linea_fin": chunk.linea_fin,
            "lenguaje": chunk.lenguaje,
        }
        claves_corpus.append(clave)
        corpus_tokens.append(_tokenizar(chunk.texto))



    # 2. Busqueda LEXICA (BM25) sobre el corpus del proyecto.
    ranking_bm25 = []
    try:
        from rank_bm25 import BM25Okapi # import para usar BM25
        bm25 = BM25Okapi(corpus_tokens) # construye el indice lexico con todos los chunks del proyecto
        notas = bm25.get_scores(_tokenizar(consulta))  # puntua cada chunk segun cuanto coincide con la pregunta
        
        # Ordenamos las claves por nota descendente y nos quedamos con las top-k.
        indices_ordenados = sorted(range(len(claves_corpus)), key=lambda i: notas[i], reverse=True)
        for i in indices_ordenados[:settings.RAG_TOP_K]:
            ranking_bm25.append(claves_corpus[i])

    except Exception as e:
        # BM25 nunca debe tumbar la recuperacion: si falla, seguimos solo con la semantica.
        log_error("Fallo la busqueda lexica BM25", e)




    # 3. Busqueda SEMANTICA (vectorial) sobre Chroma, acotada por usuario y proyecto.
    ranking_vectorial = []
    try:
        vector_consulta = embeder_consulta(consulta)
        resultado = VectorStore.consultar(vector_consulta, settings.RAG_TOP_K, usuario_id, proyecto_id)

        # Chroma devuelve los ids envueltos en una lista (una por consulta): resultado["ids"][0]
        if resultado["ids"] and resultado["ids"][0]:
            ranking_vectorial = resultado["ids"][0]
    except Exception as e:
        # Igual que BM25: si la semantica falla, seguimos solo con la lexica.
        log_error("Fallo la busqueda vectorial en Chroma", e)




    # 4. FUSION de ambos rankings con RRF.
    fusionados = _fusionar_rrf([ranking_vectorial, ranking_bm25])

    # Convertimos las claves fusionadas (top-k) en candidatos con su texto+metadata.
    # (Filtramos claves que no esten en info_por_clave por si Chroma devolviera algun chunk ya borrado de la BD.)
    candidatos = []
    for clave in fusionados[:settings.RAG_TOP_K]:
        if clave in info_por_clave:
            candidatos.append(info_por_clave[clave])

    if not candidatos:
        return []



    # 5. RERANKING: el cross-encoder reordena los candidatos y deja los TOP_N mejores.(Usamos Reranker.py)
    return reordenar(consulta, candidatos, settings.RAG_TOP_N)
