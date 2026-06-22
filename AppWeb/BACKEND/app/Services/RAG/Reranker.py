from app.Core.config import settings
from app.Helpers.Log import log_info

# Wrapper del modelo de RERANKING (cross-encoder BGE).

# Diferencia con los embeddings: el modelo de embeddings mira la pregunta y el texto POR SEPARADO (cada uno -> su vector, luego se comparan). El reranker (cross-encoder) mira la pregunta y el texto JUNTOS y da una nota de "como de bien responde ESTE texto a ESTA pregunta". Es mas preciso pero mas lento, por eso solo se usa sobre un puñado de candidatos (no sobre miles).


_modelo = None


def _obtener_modelo():
    global _modelo
    if _modelo is None:
        from sentence_transformers import CrossEncoder
        log_info(f"Cargando modelo de reranking '{settings.RERANKER_MODEL}' (puede tardar la primera vez)")
        _modelo = CrossEncoder(settings.RERANKER_MODEL)
    return _modelo


# Reordena una lista de candidatos por relevancia real a la consulta y devuelve los top_n mejores.
# Cada candidato es un dict que debe tener al menos la clave "texto".
def reordenar(consulta: str, candidatos: list[dict], top_n: int) -> list[dict]:
    if not candidatos:
        return []

    modelo = _obtener_modelo()

    # El cross-encoder puntua pares (pregunta, texto_candidato).
    pares = []
    for c in candidatos:
        pares.append((consulta, c["texto"]))

    notas = modelo.predict(pares)

    # Emparejamos cada candidato con su nota y ordenamos de mayor a menor relevancia.
    puntuados = []
    for i in range(len(candidatos)):
        puntuados.append((float(notas[i]), candidatos[i]))
    puntuados.sort(key=lambda par: par[0], reverse=True)

    # Devolvemos solo los top_n candidatos (sin la nota).
    resultado = []
    for (nota, candidato) in puntuados[:top_n]:
        resultado.append(candidato)
    return resultado
