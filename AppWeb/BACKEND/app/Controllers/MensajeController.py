from fastapi import APIRouter, HTTPException, Header
from app.Core.database import SessionLocal
from app.Models.Mensaje import Mensaje
from app.Models.Conversacion import Conversacion
from app.Schemas.MensajeSchema import MensajeRespuesta, MensajeChatEntrada
from app.Core.security import get_usuario_del_token
from app.Services.GeminiService import llamar_gemini

router = APIRouter()

# GET    /mensajes/conversacion/{id}        → Lista todos los mensajes de una conversacion
# POST   /mensajes/conversacion/{id}/chat   → Envia un mensaje al chat de IA y guarda la respuesta
# DELETE /mensajes/{id}                     → Elimina un mensaje


# Estructura que recibe: solo el token JWT en el header Authorization
@router.get("/conversacion/{conversacion_id}", response_model=list[MensajeRespuesta])
def obtener_mensajes(conversacion_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()

    # Verificamos que la conversacion pertenece al usuario antes de listar sus mensajes
    conversacion = db.query(Conversacion).filter(Conversacion.id == conversacion_id, Conversacion.usuario_id == usuario.id).first() # SELECT * FROM Conversacion WHERE id = conversacion_id AND usuario_id = usuario.id LIMIT 1

    if not conversacion:
        db.close()
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    mensajes = db.query(Mensaje).filter(Mensaje.conversacion_id == conversacion_id).all() # SELECT * FROM Mensaje WHERE conversacion_id = conversacion_id
    db.close()

    return mensajes # Devuelve un array donde cada elemento es un json perteneciente a un mensaje


# Estructura que recibe: datos = { "contenido": str }
# Guarda el mensaje del usuario, llama a Gemini con el historial completo y guarda la respuesta
# Esta ruta va ANTES que POST /conversacion/{id} para que FastAPI la encuentre primero
@router.post("/conversacion/{conversacion_id}/chat", response_model=MensajeRespuesta)
def chat_ia(conversacion_id: int, datos: MensajeChatEntrada, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()

    #Obtenemos la conversacion y verificamos si existe
    conversacion = db.query(Conversacion).filter(Conversacion.id == conversacion_id, Conversacion.usuario_id == usuario.id).first()
    if not conversacion:
        db.close()
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    # Guardamos el mensaje del usuario en la BD
    mensaje_usuario = Mensaje(contenido=datos.contenido, rol="usuario", conversacion_id=conversacion_id)
    db.add(mensaje_usuario)
    db.commit()

    # Recuperamos el historial completo (incluye el mensaje que acabamos de guardar)
    # SELECT * FROM Mensaje WHERE conversacion_id = conversacion_id ORDER BY fecha ASC
    historial = db.query(Mensaje).filter(Mensaje.conversacion_id == conversacion_id).order_by(Mensaje.fecha).all()

    # El historial para Gemini es todo menos el último mensaje (que es el que acaba de enviar)
    historial_previo = historial[:-1]

    try:
        respuesta_texto = llamar_gemini(historial_previo, datos.contenido) #Basicamente le estamos pasando el contexto de la conversacion y el mensaje que debe responder
    except Exception as e:
        # Si Gemini falla, borramos el mensaje del usuario para no dejarlo huerfano sin respuesta
        db.delete(mensaje_usuario)
        db.commit()
        db.close()
        raise HTTPException(status_code=500, detail="Error al llamar a Gemini: " + str(e))

    # Guardamos la respuesta de la IA en la BD
    mensaje_ia = Mensaje(contenido=respuesta_texto, rol="ia", conversacion_id=conversacion_id)
    db.add(mensaje_ia)
    db.commit()
    db.refresh(mensaje_ia)
    db.close()

    return mensaje_ia



# Estructura que recibe: solo el token JWT en el header Authorization
@router.delete("/{mensaje_id}")
def eliminar_mensaje(mensaje_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()

    # Hacemos JOIN con Conversacion para verificar que el usuario es el dueño de la conversacion a la que pertenece el mensaje
    mensaje = db.query(Mensaje).join(Conversacion).filter(Mensaje.id == mensaje_id,Conversacion.usuario_id == usuario.id).first() # SELECT * FROM Mensaje JOIN Conversacion ON Mensaje.conversacion_id = Conversacion.id WHERE Mensaje.id = mensaje_id AND Conversacion.usuario_id = usuario.id LIMIT 1

    if not mensaje:
        db.close()
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")

    db.delete(mensaje)
    db.commit()
    db.close()

    return {"mensaje": "Mensaje eliminado correctamente"}
