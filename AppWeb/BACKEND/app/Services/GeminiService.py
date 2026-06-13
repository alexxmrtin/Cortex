from google import genai
from google.genai import types
from app.Core.config import settings

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



def llamar_gemini(historial_db, mensaje_nuevo: str) -> str:
    historial = _convertir_historial(historial_db) #Llamamos a la funcion que acabamos de crear arriba para que nos devuelva el array de objetos types


    # Iniciamos el chat con el historial previo de la conversación, cada vez que el usuario envia un mensaje, le pasamos la conversacion entera
    chat = cliente.chats.create(model="gemini-2.0-flash", history=historial)

    respuesta = chat.send_message(mensaje_nuevo)

    return respuesta.text
