import json
from types import SimpleNamespace
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from app.Core.database import SessionLocal
from app.Models.Mensaje import Mensaje
from app.Models.Conversacion import Conversacion
from app.Schemas.MensajeSchema import MensajeRespuesta, MensajeChatEntrada
from app.Core.security import get_usuario_del_token
from app.Helpers.Cache import incrementar_cache, decrementar_cache,guardar_cache,obtener_cache
from app.Helpers.Log import log_info, log_error
from app.Services.GeminiService import llamar_gemini, ping_gemini, llamar_gemini_stream
from app.Services.ClaudeService import llamar_claude, ping_claude, llamar_claude_stream
from app.Services.GroqService import llamar_groq, ping_groq, llamar_groq_stream
from app.Services.RAG.Retrieval import recuperar
from app.Services.RAG.PromptBuilder import construir_prompt
from app.Services.RAG.QueryRewrite import reescribir

router = APIRouter()

# Modelos servidos por Groq (un mismo SDK sirve varios). Sirve para enrutar el modelo activo del usuario
# al servicio correcto en los tres sitios donde se despacha (health, chat, chat/stream).
MODELOS_GROQ = ("qwen/qwen3-32b", "llama-3.3-70b-versatile")

# GET    /mensajes/conversacion/{id}             → Lista todos los mensajes de una conversacion
# POST   /mensajes/conversacion/{id}/chat        → Envia un mensaje al chat de IA y guarda la respuesta
# POST   /mensajes/conversacion/{id}/chat/stream → Igual que /chat pero con streaming (SSE), token a token
# DELETE /mensajes/{id}                          → Elimina un mensaje
# GET    /mensajes/health                        → Comprueba si el modelo activo del usuario responde


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
    elif usuario.modeloIA in MODELOS_GROQ:
        activo = ping_groq(usuario.modeloIA)
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

    # --- RAG: si la conversacion esta ligada a un proyecto, recuperamos los trozos de codigo relevantes y construimos el system_prompt anclado (con citaciones y abstencion). Si no hay proyecto, el prompt queda vacio y la IA responde como un chat normal.
    system_prompt = ""
    fuentes = []
    if conversacion.proyecto_id:
        try:
            # Copilot (multi-turno): reescribimos la pregunta a una consulta autonoma resolviendo referencias ("eso", "esa funcion"...) con el historial. Se usa SOLO para recuperar; la pregunta original (datos.contenido) es la que respondera la IA mas abajo, sin tocar.
            consulta_rag = reescribir(historial_previo, datos.contenido, usuario.modeloIA)
            chunks = recuperar(consulta_rag, usuario.id, conversacion.proyecto_id)
            system_prompt, fuentes = construir_prompt(consulta_rag, chunks)
        except Exception as e:
            # Si la recuperacion falla, no rompemos el chat: respondemos sin contexto de proyecto.
            log_error(f"Fallo la recuperacion RAG en la conversacion {conversacion_id}", e)
            system_prompt = ""
            fuentes = []

    #Llamadas a las APIs de las IAs
    try:
        if usuario.modeloIA == "claude-sonnet-4-6":
            respuesta_texto = llamar_claude(historial_previo, datos.contenido, system_prompt)
        elif usuario.modeloIA in MODELOS_GROQ:
            respuesta_texto = llamar_groq(historial_previo, datos.contenido, system_prompt, usuario.modeloIA)
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

    # Adjuntamos las fuentes del RAG a la respuesta (atributo no persistido, solo para serializar al frontend).
    # No se guardan en la BD: son efimeras de esta respuesta. El schema MensajeRespuesta las incluye.
    mensaje_ia.fuentes = fuentes

    return mensaje_ia



# Estructura que recibe: datos = { "contenido": str }
# Igual que /chat pero con STREAMING (SSE): la respuesta de la IA llega fragmento a fragmento en tiempo real.
# El endpoint /chat normal se mantiene para compatibilidad; este es el que dara la sensacion "copilot".
#
# Formato de la respuesta (text/event-stream): una sucesion de eventos "data: <json>\n\n":
#   {"tipo":"token","contenido":"..."}        -> un fragmento de texto (se van concatenando)
#   {"tipo":"fin","id":123,"fuentes":[...]}    -> fin: id del mensaje guardado + fuentes del RAG
#   {"tipo":"error","detalle":"..."}           -> algo fallo durante la generacion
@router.post("/conversacion/{conversacion_id}/chat/stream")
def chat_ia_stream(conversacion_id: int, datos: MensajeChatEntrada, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()

    # Verificamos que la conversacion existe y es del usuario
    conversacion = db.query(Conversacion).filter(Conversacion.id == conversacion_id, Conversacion.usuario_id == usuario.id).first()
    if not conversacion:
        db.close()
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    # Limite diario de IA (mismo contador en Redis que /chat)
    hoy = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    clave_limite = "ia:peticiones:" + str(usuario.id) + ":" + hoy
    peticiones_hoy = incrementar_cache(clave_limite, 86400)
    if peticiones_hoy is not None and peticiones_hoy > 50:
        decrementar_cache(clave_limite)
        db.close()
        log_info(f"Limite diario de IA alcanzado por el usuario {usuario.id}")
        raise HTTPException(status_code=429, detail="Has alcanzado el límite diario de 50 peticiones")

    # Guardamos el mensaje del usuario
    mensaje_usuario = Mensaje(contenido=datos.contenido, rol="usuario", conversacion_id=conversacion_id)
    db.add(mensaje_usuario)
    db.commit()
    mensaje_usuario_id = mensaje_usuario.id

    # Historial previo (todo menos el mensaje recien guardado)
    historial = db.query(Mensaje).filter(Mensaje.conversacion_id == conversacion_id).order_by(Mensaje.fecha).all()
    historial_previo_orm = historial[:-1]

    # Convertimos el historial a objetos planos (SimpleNamespace) porque la respuesta se genera DENTRO de un generador, despues de cerrar la sesion; asi evitamos acceder a objetos ORM "desconectados".
    historial_previo = []
    for m in historial_previo_orm:
        historial_previo.append(SimpleNamespace(rol=m.rol, contenido=m.contenido))

    # Capturamos en primitivas todo lo que el generador necesita y cerramos la sesion
    proyecto_id = conversacion.proyecto_id
    modelo = usuario.modeloIA
    usuario_id = usuario.id
    contenido = datos.contenido
    db.close()

    # RAG (igual que /chat): reescritura multi-turno + recuperacion + construccion del prompt
    system_prompt = ""
    fuentes = []
    if proyecto_id:
        try:
            consulta_rag = reescribir(historial_previo, contenido, modelo)
            chunks = recuperar(consulta_rag, usuario_id, proyecto_id)
            system_prompt, fuentes = construir_prompt(consulta_rag, chunks)
        except Exception as e:
            log_error(f"Fallo la recuperacion RAG (stream) en la conversacion {conversacion_id}", e)
            system_prompt = ""
            fuentes = []

    # Empaqueta un evento como linea SSE
    def sse(payload: dict) -> str:
        return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"

    # Generador que produce los eventos SSE: tokens segun llegan, luego el evento final con id + fuentes.
    def generador():
        acumulado = []
        try:
            if modelo == "claude-sonnet-4-6":
                stream = llamar_claude_stream(historial_previo, contenido, system_prompt)
            elif modelo in MODELOS_GROQ:
                stream = llamar_groq_stream(historial_previo, contenido, system_prompt, modelo)
            else:
                stream = llamar_gemini_stream(historial_previo, contenido, system_prompt)

            for fragmento in stream:
                acumulado.append(fragmento)
                yield sse({"tipo": "token", "contenido": fragmento})

            respuesta_texto = "".join(acumulado)

            # Guardamos la respuesta completa de la IA en la BD (sesion propia del generador)
            db_gen = SessionLocal()
            mensaje_ia = Mensaje(contenido=respuesta_texto, rol="ia", conversacion_id=conversacion_id)
            db_gen.add(mensaje_ia)
            db_gen.commit()
            db_gen.refresh(mensaje_ia)
            mensaje_ia_id = mensaje_ia.id
            db_gen.close()

            yield sse({"tipo": "fin", "id": mensaje_ia_id, "fuentes": fuentes})

        except Exception as e:
            # Si la IA falla a mitad, deshacemos: borramos el mensaje del usuario y devolvemos el cupo.
            # (Ya hemos respondido 200 con el stream abierto, asi que el error se comunica como un evento.)
            db_err = SessionLocal()
            huerfano = db_err.query(Mensaje).filter(Mensaje.id == mensaje_usuario_id).first()
            if huerfano:
                db_err.delete(huerfano)
                db_err.commit()
            db_err.close()
            decrementar_cache(clave_limite)
            log_error(f"Fallo el streaming de IA en la conversacion {conversacion_id}", e)
            yield sse({"tipo": "error", "detalle": "Error al generar la respuesta de la IA"})

    # text/event-stream + cabeceras para que proxies (nginx) no almacenen en buffer el stream
    cabeceras = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    return StreamingResponse(generador(), media_type="text/event-stream", headers=cabeceras)



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
