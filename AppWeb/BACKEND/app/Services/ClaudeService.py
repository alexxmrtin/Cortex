import anthropic
from app.Core.config import settings
from app.Helpers.Log import log_error_servicio

#Este archivo conecta este backend con la API de Claude para usar su ia


# Es de pago asiq por ahora lo comentamos
# cliente = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _convertir_historial(mensajes_db):
    historial = []

    for m in mensajes_db:
        if m.rol == "usuario":
            role = "user"
        else:
            role = "assistant"

        historial.append({"role": role, "content": m.contenido})

    return historial


def ping_claude() -> bool:
    try:
        cliente = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        cliente.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1,
            messages=[{"role": "user", "content": "hi"}]
        )
        return True
    except Exception:
        return False


def llamar_claude(historial_db, mensaje_nuevo: str, system_prompt: str = "") -> str:
    # Se instancia aquí dentro (no a nivel de módulo) para que el backend arranque aunque la clave esté vacía, si queremos integrar en el futuro claude, tenemos que borrar esto, descomentarlo arriba y poner la API key en el .env
    cliente = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    historial = _convertir_historial(historial_db)
    historial.append({"role": "user", "content": mensaje_nuevo})

    try:
        kwargs = {
            "model": "claude-sonnet-4-6",
            "max_tokens": 1024,
            "messages": historial
        }
        if system_prompt:
            kwargs["system"] = system_prompt
        
        respuesta = cliente.messages.create(**kwargs)
        return respuesta.content[0].text
    
    except Exception as e:
        # El SDK lanza una excepción cuando la API devuelve un error (429, 500, etc.)
        # La capturamos aquí para escribir en el log, y luego la relanzamos con "raise"
        # para que el controlador la siga recibiendo y haga su rollback normal
        log_error_servicio("Claude", e)
        raise


# Igual que llamar_claude, pero en modo STREAMING: va "produciendo" (yield) los fragmentos segun llegan.
def llamar_claude_stream(historial_db, mensaje_nuevo: str, system_prompt: str = ""):
    cliente = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    historial = _convertir_historial(historial_db)
    historial.append({"role": "user", "content": mensaje_nuevo})

    kwargs = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 1024,
        "messages": historial
    }
    if system_prompt:
        kwargs["system"] = system_prompt

    try:
        # El SDK de Anthropic expone el streaming como un context manager con .text_stream
        with cliente.messages.stream(**kwargs) as stream:
            for fragmento in stream.text_stream:
                yield fragmento

    except Exception as e:
        log_error_servicio("Claude", e)
        raise
