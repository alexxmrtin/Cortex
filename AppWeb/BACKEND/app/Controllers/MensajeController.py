from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header
from app.Core.database import SessionLocal
from app.Models.Mensaje import Mensaje
from app.Models.Conversacion import Conversacion
from app.Schemas.MensajeSchema import MensajeRespuesta, MensajeChatEntrada
from app.Core.security import get_usuario_del_token
from app.Helpers.Cache import incrementar_cache, decrementar_cache,guardar_cache,obtener_cache
from app.Helpers.Log import log_info
from app.Services.GeminiService import llamar_gemini, ping_gemini
from app.Services.ClaudeService import llamar_claude, ping_claude
from app.Services.GroqService import llamar_groq, ping_groq

router = APIRouter()

# GET    /mensajes/conversacion/{id}        → Lista todos los mensajes de una conversacion
# POST   /mensajes/conversacion/{id}/chat   → Envia un mensaje al chat de IA y guarda la respuesta
# DELETE /mensajes/{id}                     → Elimina un mensaje
# GET    /mensajes/health                   → Comprueba si el modelo activo del usuario responde


# Estructura que recibe: solo el token JWT en el header Authorization
@router.get("/health")
def health_modelo(authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    #Implementamos caching de 15 segundos para no estar gastando token continuamente
    clave = f"health:modelo:{usuario.modeloIA}"
    cacheado = obtener_cache(clave);

    if cacheado is not None:
        return {"estado" : cacheado}


    if usuario.modeloIA == "claude-sonnet-4-6":
        activo = ping_claude()
    elif usuario.modeloIA == "llama-3.3-70b-versatile":
        activo = ping_groq()
    else:
        activo = ping_gemini()

    if activo:
        estado = "ok"
        guardar_cache(clave,estado,15)
        
        return {"estado": "ok"}
    else:
        estado = "error"
        guardar_cache(clave,estado,15)
        
        return {"estado": "error"}


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
# Guarda el mensaje del usuario, llama al modelo IA del usuario (Gemini o Claude) con el historial completo y guarda la respuesta
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



    # Verificamos que el usuario no haya superado el limite diario de 30 peticiones a la IA.
    # Usamos un contador en Redis. La clave lleva la fecha de hoy (ej: "ia:peticiones:7:2026-06-17"), asi cada dia usa una clave distinta y el limite "se reinicia" solo al cambiar de dia.
    hoy = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    clave_limite = "ia:peticiones:" + str(usuario.id) + ":" + hoy

    # Creamos una nueva entrada en el servidor REDIS que tendra valor 1 la primera vez y a medida que se vaya incrementando pasara de 1 en 1 hasta obtener 30. El TTL de 24h (86400s) solo se aplica la primera vez del dia (cuando el contador pasa a valer 1), para que la clave caduque sola.
    peticiones_hoy = incrementar_cache(clave_limite, 86400)

    # Si peticiones_hoy obtiene 30 y todavia no ha pasado las 24h decrementamos, cerramos la conexion de la db y mandamos un mensaje de error al frontend
    if peticiones_hoy is not None and peticiones_hoy > 50:
        # Esta peticion ya se pasa del tope: deshacemos el incremento para no consumir cupo y rechazamos.
        decrementar_cache(clave_limite)
        db.close()
        log_info(f"Limite diario de IA alcanzado por el usuario {usuario.id}")
        raise HTTPException(status_code=429, detail="Has alcanzado el límite diario de 50 peticiones")



    # Guardamos el mensaje del usuario en la BD
    mensaje_usuario = Mensaje(contenido=datos.contenido, rol="usuario", conversacion_id=conversacion_id)
    db.add(mensaje_usuario)
    db.commit()

    # Recuperamos el historial completo (incluye el mensaje que acabamos de guardar)
    # SELECT * FROM Mensaje WHERE conversacion_id = conversacion_id ORDER BY fecha ASC
    historial = db.query(Mensaje).filter(Mensaje.conversacion_id == conversacion_id).order_by(Mensaje.fecha).all()

    # El historial para la IA es todo menos el último mensaje (que es el que acaba de enviar)
    historial_previo = historial[:-1]

    # Por ahora no se inyecta ningun contexto de proyecto (el motor RAG se va a reimplementar)
    system_prompt = ""

    #Llamadas a las APIs de las IAs
    try:
        if usuario.modeloIA == "claude-sonnet-4-6":
            respuesta_texto = llamar_claude(historial_previo, datos.contenido, system_prompt)
        elif usuario.modeloIA == "llama-3.3-70b-versatile":
            respuesta_texto = llamar_groq(historial_previo, datos.contenido, system_prompt)
        else:
            respuesta_texto = llamar_gemini(historial_previo, datos.contenido, system_prompt)


    except Exception as e:
        # Si la IA falla, borramos el mensaje del usuario para no dejarlo huerfano sin respuesta y devolvemos el cupo al contador de Redis: esta peticion no ha llegado a completarse, asi que no debe contar contra el limite diario.
        db.delete(mensaje_usuario)
        db.commit()
        decrementar_cache(clave_limite)
        db.close()
        raise HTTPException(status_code=500, detail="Error al llamar a " + usuario.modeloIA + " :" + str(e))


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
