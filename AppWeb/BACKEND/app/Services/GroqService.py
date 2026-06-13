from groq import Groq
from app.Core.config import settings
from app.Helpers.Log import log_error_servicio

#Este archivo conecta este backend con la API de Groq para usar su ia (Llama 3.1)


def _convertir_historial(mensajes_db):
    historial = []

    for m in mensajes_db:
        if m.rol == "usuario":
            role = "user"
        else:
            role = "assistant"

        historial.append({"role": role, "content": m.contenido})

    return historial


def llamar_groq(historial_db, mensaje_nuevo: str) -> str:
    cliente = Groq(api_key=settings.GROQ_API_KEY)
    historial = _convertir_historial(historial_db)
    historial.append({"role": "user", "content": mensaje_nuevo})

    try:
        respuesta = cliente.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=historial
        )
        return respuesta.choices[0].message.content
    except Exception as e:
        # El SDK lanza una excepción cuando la API devuelve un error (429, 500, etc.)
        # La capturamos aquí para escribir en el log, y luego la relanzamos con "raise"
        # para que el controlador la siga recibiendo y haga su rollback normal
        log_error_servicio("Groq", e)
        raise
