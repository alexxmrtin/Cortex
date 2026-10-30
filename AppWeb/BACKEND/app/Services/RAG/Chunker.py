import os

# Trocea un archivo de codigo en fragmentos ("chunks") manejables para el RAG.

# Por que trocear: un archivo entero daria un solo vector "borroso" que no representa bien nada. Partimos en trozos de tamano acotado para que cada vector capture una idea concreta.

# Estrategia (sencilla y robusta): acumulamos LINEAS hasta llenar un presupuesto de caracteres, respetando los limites de linea (nunca cortamos a mitad de linea). Entre trozos consecutivos dejamos un pequeno SOLAPAMIENTO: las ultimas lineas de un trozo se repiten al principio del siguiente, para que una idea que cae justo en el corte no se pierda.

# De cada chunk guardamos de que lineas viene (linea_inicio/linea_fin) para poder citar el origen.


MAX_CARACTERES = 1600 # Tamaño por chunk. ~1600 caracteres equivale aproximadamente a 350-450 tokens de codigo.
SOLAPAMIENTO_CARACTERES = 240 #Esto es la cantidad de caracteres que vamos a repetir en cada chunk usando el anterior


#Lenguajes soportados en el RAG, sirve para ponerlo en los metadatos
_EXTENSIONES = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript", ".ts": "typescript", ".tsx": "typescript",
    ".java": "java", ".c": "c", ".h": "c", ".cpp": "cpp", ".cc": "cpp", ".hpp": "cpp", ".cs": "csharp",
    ".go": "go", ".rb": "ruby", ".php": "php", ".rs": "rust", ".kt": "kotlin", ".swift": "swift",
    ".html": "html", ".css": "css", ".scss": "scss", ".sql": "sql", ".sh": "bash", ".bash": "bash",
    ".json": "json", ".yml": "yaml", ".yaml": "yaml", ".xml": "xml", ".md": "markdown", ".txt": "texto",
}

#Detectamos el lenguaje seleccionando la extension al fvinal de la ruta
def _detectar_lenguaje(ruta_relativa: str):
    extension = os.path.splitext(ruta_relativa)[1].lower() # Sacammos la extension del archivo en minuscula
    if extension in _EXTENSIONES:
        return _EXTENSIONES[extension]
    return None


# Parte el contenido de un archivo en una lista de chunks. 
# Devuelve una lista de dicts: {indice, texto, linea_inicio, linea_fin, lenguaje} 
# (linea_inicio/linea_fin son numeros de linea empezando en 1, ambos incluidos).
def partir(contenido: str, ruta_relativa: str) -> list[dict]:
    lenguaje = _detectar_lenguaje(ruta_relativa)
    lineas = contenido.splitlines()

    if not lineas:
        return []

    chunks = []
    indice = 0
    total = len(lineas)
    i = 0  # indice de la linea actual (empezando en 0)

    while i < total:
        inicio = i
        acumuladas = []
        caracteres = 0

        # Acumulamos lineas mientras quepan en el presupuesto.
        # La condicion "acumuladas and ..." garantiza meter al menos UNA linea aunque sea enorme (una linea sola mas larga que el presupuesto se queda como su propio chunk, sin cortarla).
        while i < total:
            longitud_linea = len(lineas[i]) + 1  # +1 por el salto de linea
            if acumuladas and caracteres + longitud_linea > MAX_CARACTERES:
                break
            acumuladas.append(lineas[i])
            caracteres += longitud_linea
            i += 1

        chunks.append({
            "indice": indice,
            "texto": "\n".join(acumuladas),
            "linea_inicio": inicio + 1,  # de 0-based a 1-based
            "linea_fin": i,              # i ya apunta a la siguiente; la ultima incluida (1-based) es i
            "lenguaje": lenguaje,
        })
        indice += 1

        if i >= total:
            break

        # Solapamiento: retrocedemos i para repetir ~SOLAPAMIENTO_CARACTERES del final del chunk.
        retroceso = 0
        caracteres_retro = 0
        j = i - 1
        while j > inicio and caracteres_retro < SOLAPAMIENTO_CARACTERES:
            caracteres_retro += len(lineas[j]) + 1
            retroceso += 1
            j -= 1
        i = i - retroceso

        # Garantia de progreso: el siguiente chunk debe empezar despues del anterior (evita bucle infinito).
        if i <= inicio:
            i = inicio + 1

    return chunks
