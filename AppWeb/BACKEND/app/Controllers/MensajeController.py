import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header
from app.Core.database import SessionLocal
from app.Models.Mensaje import Mensaje
from app.Models.Conversacion import Conversacion
from app.Models.ArchivosProyecto import ArchivosProyecto
from app.Schemas.MensajeSchema import MensajeRespuesta, MensajeChatEntrada
from app.Core.security import get_usuario_del_token
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

    if usuario.modeloIA == "claude-sonnet-4-6":
        activo = ping_claude()
    elif usuario.modeloIA == "llama-3.3-70b-versatile":
        activo = ping_groq()
    else:
        activo = ping_gemini()

    if activo:
        return {"estado": "ok"}
    else:
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



    # Verificamos que el usuario no haya superado el limite diario de 30 peticiones a la IA. Contamos los mensajes con rol='usuario' de hoy en todas sus conversaciones (cada mensaje de usuario = una llamada a la IA)
    inicio_de_hoy = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # SELECT COUNT(*) FROM Mensaje JOIN Conversacion ON Mensaje.conversacion_id = Conversacion.id WHERE Conversacion.usuario_id = usuario.id AND Mensaje.rol = 'usuario' AND Mensaje.fecha >= inicio_de_hoy
    peticiones_hoy = db.query(Mensaje).join(Conversacion).filter(
        Conversacion.usuario_id == usuario.id,
        Mensaje.rol == "usuario",
        Mensaje.fecha >= inicio_de_hoy
    ).count()

    if peticiones_hoy >= 30:
        db.close()
        raise HTTPException(status_code=429, detail="Has alcanzado el límite diario de 30 peticiones")



    # Guardamos el mensaje del usuario en la BD
    mensaje_usuario = Mensaje(contenido=datos.contenido, rol="usuario", conversacion_id=conversacion_id)
    db.add(mensaje_usuario)
    db.commit()


    # Recuperamos el historial completo (incluye el mensaje que acabamos de guardar)
    # SELECT * FROM Mensaje WHERE conversacion_id = conversacion_id ORDER BY fecha ASC
    historial = db.query(Mensaje).filter(Mensaje.conversacion_id == conversacion_id).order_by(Mensaje.fecha).all()

    # El historial para la IA es todo menos el último mensaje (que es el que acaba de enviar)
    historial_previo = historial[:-1]

    #------------------------------------------------------------------------------------------------------------
    # Si la conversación está vinculada a un proyecto, le damos a la IA el contenido de los archivos relevantes como contexto
    
    # FLUJO DEL BLOQUE:
    #   1. Traemos todos los archivos del proyecto desde la BD.
    #   2. Partimos el mensaje del usuario en palabras (en minuscula) y buscamos archivos cuyo nombre (con o sin extension) coincida con alguna palabra.
    #   3. Leemos la cola de IDs usados como contexto en mensajes anteriores (guardada como CSV en archivos_contexto) y le añadimos los nuevos al final, sin duplicar.
    #   4. La cola tiene un tope de 10: si se pasa, se descartan los mas antiguos (los del principio). Guardamos la cola actualizada en la BD.
    #   5. Buscamos SIEMPRE el README.txt del proyecto, aparte de la cola, para tenerlo como contexto perpetuo (el tope de 10 nunca lo expulsa).
    #   6. Ordenamos los archivos por PRIORIDAD para gastar el presupuesto de caracteres: 1º los del mensaje actual, 2º el README, 3º el resto de la cola (del mas reciente al mas antiguo).
    #   7. Cargamos el contenido en ese orden hasta un tope de caracteres (depende del modelo: mas bajo para Llama/Groq, mas alto para Gemini/Claude) y lo metemos en el system_prompt. Lo que no cabe se recorta o se queda fuera (lo menos prioritario).
    #   Asi la IA tiene siempre el README, el archivo por el que pregunta el usuario y los mencionados a lo largo de la conversacion.
    
    system_prompt = ""
    if conversacion.proyecto_id:
        # SELECT * FROM ArchivosProyecto WHERE proyecto_id = conversacion.proyecto_id
        todos_archivos = db.query(ArchivosProyecto).filter(ArchivosProyecto.proyecto_id == conversacion.proyecto_id).all()

        # Convertimos el mensaje del usuario en un conjunto de palabras en minuscula
        palabras = set()
        for palabra in datos.contenido.split():
            palabras.add(palabra.lower())

        # Buscamos archivos cuyo nombre coincida exactamente con alguna palabra del mensaje (con o sin extensión)
        ids_nuevos = []
        for archivo in todos_archivos:
            nombre_completo = os.path.basename(archivo.rutaRelativa).lower()   # "conversacioncontroller.py"
            nombre_sin_ext = os.path.splitext(nombre_completo)[0]              # "conversacioncontroller"
            if nombre_sin_ext in palabras or nombre_completo in palabras:
                ids_nuevos.append(archivo.id)

        # Recuperamos los IDs de archivos que ya se usaron como contexto en mensajes anteriores (CSV "1,3,5")
        # Asi la IA mantiene el contexto de todos los archivos mencionados a lo largo de la conversacion
        ids_acumulados = []
        if conversacion.archivos_contexto:
            for trozo in conversacion.archivos_contexto.split(","):
                ids_acumulados.append(int(trozo))

        # Añadimos los nuevos IDs al final, sin duplicar los que ya estaban
        for id_nuevo in ids_nuevos:
            if id_nuevo not in ids_acumulados:
                ids_acumulados.append(id_nuevo)

        # Como maximo guardamos 10 archivos: si nos pasamos, descartamos los mas antiguos (los del principio)
        if len(ids_acumulados) > 10:
            ids_acumulados = ids_acumulados[-10:]

        # Guardamos la lista actualizada en la BD (convertimos cada ID a texto y los unimos con comas)
        partes_csv = []
        for id_archivo in ids_acumulados:
            partes_csv.append(str(id_archivo))
        conversacion.archivos_contexto = ",".join(partes_csv)
        db.commit()

        # Buscamos el README del proyecto SIEMPRE (en cada mensaje), para tenerlo como contexto perpetuo.
        # Lo manejamos aparte de la cola para que el tope de 10 nunca lo expulse.
        id_readme = None
        for archivo in todos_archivos:
            if os.path.basename(archivo.rutaRelativa).lower() == "readme.txt":
                id_readme = archivo.id
                break


        ###########################################################################################
        # Orden de PRIORIDAD para gastar el presupuesto de caracteres (lo mas importante primero):
        #   1. Archivos que el usuario menciona en ESTE mensaje -> nunca se quedan fuera
        #   2. El README                                        -> contexto perpetuo del proyecto
        #   3. El resto de archivos acumulados, del mas reciente al mas antiguo
        # Si al final no cabe todo, se sacrifican los menos prioritarios (los acumulados mas antiguos).
        ids_ordenados = []
        for id_archivo in ids_nuevos:
            if id_archivo not in ids_ordenados:
                ids_ordenados.append(id_archivo)
        if id_readme is not None and id_readme not in ids_ordenados:
            ids_ordenados.append(id_readme)
        for id_archivo in reversed(ids_acumulados):
            if id_archivo not in ids_ordenados:
                ids_ordenados.append(id_archivo)

        # Convertimos los ids en objetos archivo, respetando ese orden de prioridad
        archivos = []
        for id_archivo in ids_ordenados:
            for archivo in todos_archivos:
                if archivo.id == id_archivo:
                    archivos.append(archivo)
                    break
        #############################################################################################
        

        # Leemos el contenido de los archivos con un tope total de caracteres, para no superar el limite de tokens del modelo (sobre todo Llama via Groq, que da error 413 si el mensaje es muy grande).
        # Como 'archivos' ya esta en orden de prioridad, lo recorremos tal cual (sin reversed): si se acaba el presupuesto, los que se quedan fuera son los menos prioritarios.
        
        # El tope depende del modelo: Gemini y Claude tienen ~1M tokens de contexto, asi que podemos darles mucho mas;
        # Llama via Groq es el mas restrictivo (limites por peticion + error 413), por eso le dejamos un presupuesto mas bajo.
        if usuario.modeloIA == "llama-3.3-70b-versatile":
            MAX_CARACTERES_CONTEXTO = 30000
        else:
            MAX_CARACTERES_CONTEXTO = 60000
        
        
        caracteres_usados = 0
        bloques = []
        for archivo in archivos:
            # Si ya no queda presupuesto, paramos (los archivos restantes son aun mas antiguos)
            if caracteres_usados >= MAX_CARACTERES_CONTEXTO:
                break

            try:
                with open(archivo.rutaDisco, "r", encoding="utf-8") as f:
                    contenido = f.read()
            except (UnicodeDecodeError, FileNotFoundError, OSError):
                continue

            bloque = f"=== {archivo.rutaRelativa} ===\n{contenido}\n"

            #Recortamos el archivo para usar exactamente los 15000 caracteres.Si el bloque no cabe entero en lo que queda de presupuesto, lo recortamos, lo añadimos y paramos (ya no queda sitio para mas)
            espacio_restante = MAX_CARACTERES_CONTEXTO - caracteres_usados
            if len(bloque) > espacio_restante:
                bloque = bloque[:espacio_restante] + "\n... (archivo recortado por tamaño)\n" 
                bloques.append(bloque)
                break

            caracteres_usados = caracteres_usados + len(bloque)
            bloques.append(bloque)


        #Ahora vamos a crear los promts para pasarle al agente IA
        partes = ["Eres un asistente analizando un proyecto de código.No tienes acceso a todo el contenido del proyecto, si necesitas mas informacion o el usuario te pregunta sobre un archivo que no te estoy dando, pidele el nombre exacto del archivo en cuestion. Aquí están los archivos relevantes del proyecto para la conversacion:\n"]
        for bloque in bloques:
            partes.append(bloque)

        if len(partes) > 1:
            # Hay archivos relevantes: los incluimos como contexto
            system_prompt = "\n".join(partes)
        else:
            # No se encontró ningún archivo: le indicamos a la IA que pida el nombre exacto
            system_prompt = "Eres un asistente analizando un proyecto de código. Solo tienes acceso al README del proyecto en caso de que exista el archivo. Si el usuario pregunta sobre un archivo concreto, pídele que mencione su nombre exacto para que puedas ayudarle y si necesitas mas contexto o informacion, le pides el nombre de los archivos necesarios."

        #---------------------------------------------------------------------------------------------------------------

    #Llamadas a las APIs de las IAs
    try:
        if usuario.modeloIA == "claude-sonnet-4-6":
            respuesta_texto = llamar_claude(historial_previo, datos.contenido, system_prompt)
        elif usuario.modeloIA == "llama-3.3-70b-versatile":
            respuesta_texto = llamar_groq(historial_previo, datos.contenido, system_prompt)
        else:
            respuesta_texto = llamar_gemini(historial_previo, datos.contenido, system_prompt)


    except Exception as e:
        # Si la IA falla, borramos el mensaje del usuario para no dejarlo huerfano sin respuesta
        db.delete(mensaje_usuario)
        db.commit()
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
