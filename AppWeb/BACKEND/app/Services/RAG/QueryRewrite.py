from app.Helpers.Log import log_info, log_error
from app.Services.GeminiService import llamar_gemini
from app.Services.GroqService import llamar_groq
from app.Services.ClaudeService import llamar_claude

# Reescritura de consulta multi-turno (capa copilot).

# Problema que resuelve: en una conversacion, los "follow-ups" no son autonomos. Si el usuario pregunta "¿y eso donde se usa?", esa frase suelta no sirve para buscar (no tiene terminos utiles). Antes de recuperar, reescribimos la pregunta a una CONSULTA AUTONOMA usando el historial, resolviendo referencias como "eso", "esa funcion", "ahi" -> "¿donde se usa la funcion verificar_credenciales?".

# IMPORTANTE: la consulta reescrita se usa SOLO para recuperar contexto. La pregunta original del usuario es la que se le pasa a la IA para responder; aqui no la tocamos.

# Cuantos mensajes recientes del historial damos como contexto para resolver las referencias. Pocos a proposito: el reescritor solo necesita el hilo inmediato, y asi la llamada es barata.
MAX_MENSAJES_CONTEXTO = 6

_INSTRUCCIONES = (
    "Eres un componente que reescribe la ultima pregunta del usuario como una consulta de busqueda "
    "AUTONOMA y autocontenida para un buscador de codigo. Resuelve las referencias ('eso', 'esa funcion', "
    "'ahi', 'el anterior'...) usando la conversacion previa. "
    "Devuelve UNICAMENTE la consulta reescrita, en una sola linea, sin comillas ni explicaciones. "
    "Si la pregunta ya es autonoma, devuelvela tal cual."
)


# Convierte los ultimos mensajes del historial en texto plano para dar contexto al reescritor. Coge los ultimos 6 mensajes (6 en el momento que estoy escribiendo este comentario) y los junta en un unico mensaje de texto plano.
def _texto_historial(historial_previo) -> str:
    recientes = historial_previo[-MAX_MENSAJES_CONTEXTO:]
    lineas = []
    for m in recientes:
        if m.rol == "usuario":
            quien = "Usuario"
        else:
            quien = "Asistente"
        lineas.append(f"{quien}: {m.contenido}")
    return "\n".join(lineas)


# Reescribe la pregunta del usuario a una consulta autonoma. Usa el modelo activo del usuario.
# Nunca lanza excepcion: si algo falla, devuelve la pregunta original (degradacion elegante).
def reescribir(historial_previo, mensaje_nuevo: str, modelo_ia: str) -> str:
    # Sin historial no hay nada que resolver: la pregunta ya ES la consulta.
    if not historial_previo:
        return mensaje_nuevo

    contexto = _texto_historial(historial_previo)
    mensaje = (
        "Conversacion previa:\n" + contexto
        + "\n\nUltima pregunta del usuario: " + mensaje_nuevo
        + "\n\nConsulta reescrita:"
    )

    try:
        # Reutilizamos el servicio del modelo activo del usuario, con historial vacio (es un one-shot).
        if modelo_ia == "claude-sonnet-4-6":
            reescrita = llamar_claude([], mensaje, _INSTRUCCIONES)
        elif modelo_ia in ("qwen/qwen3-32b", "llama-3.3-70b-versatile"):
            reescrita = llamar_groq([], mensaje, _INSTRUCCIONES, modelo_ia)
        else:
            reescrita = llamar_gemini([], mensaje, _INSTRUCCIONES)

        reescrita = reescrita.strip()

        # Si el modelo devuelve algo vacio o raro, nos quedamos con la original.
        if not reescrita:
            return mensaje_nuevo

        if reescrita != mensaje_nuevo:
            log_info(f"Consulta reescrita para RAG: '{mensaje_nuevo}' -> '{reescrita}'")
        return reescrita

    except Exception as e:
        # Si la reescritura falla, seguimos con la pregunta original; nunca rompemos el chat por esto.
        log_error("Fallo la reescritura de consulta multi-turno", e)
        return mensaje_nuevo
