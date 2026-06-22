from groq import Groq
from app.Core.config import settings
from app.Helpers.Log import log_error_servicio

# Este archivo conecta el backend con la API de Groq. Groq sirve varios modelos; en Cortex usamos:
#   - "llama-3.3-70b-versatile"  (Llama 3.3 70B)
#   - "qwen/qwen3-32b"           (Qwen3 32B, modelo de razonamiento)
# Por eso las funciones reciben el 'modelo' como parametro en vez de tenerlo fijo.

MODELO_POR_DEFECTO = "qwen/qwen3-32b"


def _convertir_historial(mensajes_db):
    historial = []

    for m in mensajes_db:
        if m.rol == "usuario":
            role = "user"
        else:
            role = "assistant"

        historial.append({"role": role, "content": m.contenido})

    return historial


# Construye los argumentos comunes de la llamada. Para los modelos Qwen (de razonamiento) añadimos reasoning_format="hidden", que hace que Groq devuelva SOLO la respuesta final, sin el bloque <think> con el razonamiento interno (que no queremos mostrar ni guardar en el chat).
def _kwargs(modelo: str, mensajes: list, stream: bool) -> dict:
    kwargs = {"model": modelo, "messages": mensajes}
    if stream:
        kwargs["stream"] = True
    if "qwen" in modelo:
        kwargs["reasoning_format"] = "hidden"
    return kwargs


def ping_groq(modelo: str = MODELO_POR_DEFECTO) -> bool:
    try:
        cliente = Groq(api_key=settings.GROQ_API_KEY)
        kwargs = _kwargs(modelo, [{"role": "user", "content": "hi"}], stream=False)
        kwargs["max_tokens"] = 1
        cliente.chat.completions.create(**kwargs)
        return True
    except Exception:
        return False


def llamar_groq(historial_db, mensaje_nuevo: str, system_prompt: str = "", modelo: str = MODELO_POR_DEFECTO) -> str:
    cliente = Groq(api_key=settings.GROQ_API_KEY)

    # Groq acepta un mensaje de sistema como primer elemento del historial con role='system'
    historial = []
    if system_prompt:
        historial.append({"role": "system", "content": system_prompt})
    historial += _convertir_historial(historial_db)
    historial.append({"role": "user", "content": mensaje_nuevo})

    try:
        respuesta = cliente.chat.completions.create(**_kwargs(modelo, historial, stream=False))
        return respuesta.choices[0].message.content

    except Exception as e:
        # El SDK lanza una excepción cuando la API devuelve un error (429, 500, etc.)
        # La capturamos aquí para escribir en el log, y luego la relanzamos con "raise"
        # para que el controlador la siga recibiendo y haga su rollback normal
        log_error_servicio("Groq", e)
        raise


# Igual que llamar_groq, pero en modo STREAMING: va "produciendo" (yield) los fragmentos segun llegan.
def llamar_groq_stream(historial_db, mensaje_nuevo: str, system_prompt: str = "", modelo: str = MODELO_POR_DEFECTO):
    cliente = Groq(api_key=settings.GROQ_API_KEY)

    historial = []
    if system_prompt:
        historial.append({"role": "system", "content": system_prompt})
    historial += _convertir_historial(historial_db)
    historial.append({"role": "user", "content": mensaje_nuevo})

    try:
        stream = cliente.chat.completions.create(**_kwargs(modelo, historial, stream=True))
        for fragmento in stream:
            contenido = fragmento.choices[0].delta.content
            if contenido:
                yield contenido

    except Exception as e:
        log_error_servicio("Groq", e)
        raise
