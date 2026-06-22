from google import genai
from google.genai import types
from app.Core.config import settings
from app.Helpers.Log import log_error_servicio

#Este archivo conecta este backend con la API de Gemini para usar su ia



# Inicializamos el cliente de Gemini con la API key del .env
cliente = genai.Client(api_key=settings.GEMINI_API_KEY)


# Convierte los mensajes de la BD al formato que espera Gemini: lista de Content(role, parts)
# La BD usa rol='usuario'/'ia', Gemini usa role='user'/'model'
def _convertir_historial(mensajes_db):
    historial = []
    
    for m in mensajes_db:
        if m.rol == "usuario":
            role = "user"
        else:
            role = "model"

        #types es la clase que usa SDK de Gemini para representar un mensaje en el historial de chat,usamos el metodo types.content() para meter informacion en la clase tiene dos campos, el rol y el contenido, el contenido es types.Part que es un metodo de la clase types para representar la informacion, en este caso es texto pero tambien podriamos enviar imagenes, archivos...  
        historial.append(types.Content(role=role, parts=[types.Part(text=m.contenido)]))
    
    return historial



def ping_gemini() -> bool:
    try:
        cliente.models.generate_content(
            model="gemini-2.0-flash",
            contents="hi",
            config=types.GenerateContentConfig(max_output_tokens=1)
        )
        return True
    except Exception:
        return False


def llamar_gemini(historial_db, mensaje_nuevo: str, system_prompt: str = "") -> str:
    historial = _convertir_historial(historial_db) #Llamamos a la funcion que acabamos de crear arriba para que nos devuelva el array de objetos types

    # Iniciamos el chat con el historial previo de la conversación, cada vez que el usuario envia un mensaje, le pasamos la conversacion entera
    try:
        config = types.GenerateContentConfig(system_instruction=system_prompt) if system_prompt else None
        chat = cliente.chats.create(model="gemini-2.0-flash", history=historial, config=config)
        respuesta = chat.send_message(mensaje_nuevo)
        return respuesta.text
    
    except Exception as e:
        # El SDK lanza una excepción cuando la API devuelve un error (429, 500, etc.)
        # La capturamos aquí para escribir en el log, y luego la relanzamos con "raise"
        # para que el controlador la siga recibiendo y haga su rollback normal
        log_error_servicio("Gemini", e)
        raise


# Igual que llamar_gemini, pero en modo STREAMING: en vez de devolver el texto entero, va "produciendo" los fragmentos a medida que el modelo los genera. Lo consume el endpoint de chat con streaming.
def llamar_gemini_stream(historial_db, mensaje_nuevo: str, system_prompt: str = ""):
    historial = _convertir_historial(historial_db)

    if system_prompt:
        config = types.GenerateContentConfig(system_instruction=system_prompt)
    else:
        config = None

    try:
        chat = cliente.chats.create(model="gemini-2.0-flash", history=historial, config=config)
        for fragmento in chat.send_message_stream(mensaje_nuevo):
            if fragmento.text:
                yield fragmento.text #yield devuelve cada fragmento uno a uno, si pusieramos un return aqui, devolveria solo el primer fragmento

    except Exception as e:
        log_error_servicio("Gemini", e)
        raise
