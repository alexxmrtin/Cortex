from fastapi import APIRouter, HTTPException, Header
from app.Core.database import SessionLocal
from app.Models.Conversacion import Conversacion
from app.Schemas.ConversacionSchema import ConversacionCrear, ConversacionRespuesta, ConversacionActualizar
from app.Core.security import get_usuario_del_token
from app.Helpers.Sanitizar import sanitizar
from datetime import datetime

router = APIRouter()

# GET    /conversaciones/            → Lista todas las conversaciones del usuario
# POST   /conversaciones/            → Crea una nueva conversacion
# GET    /conversaciones/{id}        → Obtiene una conversacion concreta
# PATCH  /conversaciones/{id}        → Actualiza el titulo de la conversacion
# DELETE /conversaciones/{id}        → Elimina la conversacion


# Estructura que recibe: solo el token JWT en el header Authorization
@router.get("/", response_model=list[ConversacionRespuesta])
def obtener_conversaciones(authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    conversaciones = db.query(Conversacion).filter(Conversacion.usuario_id == usuario.id).all() # SELECT * FROM Conversacion WHERE usuario_id = usuario.id
    db.close()

    return conversaciones



# Estructura que recibe: datos = { "titulo": str }
# El titulo se genera automaticamente con las primeras palabras del primer mensaje
@router.post("/", response_model=ConversacionRespuesta)
def crear_conversacion(datos: ConversacionCrear, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()

    try:
        titulo = sanitizar(datos.titulo)
    except ValueError:
        titulo = f"Conversacion {datetime.now().strftime('%d/%m/%Y %H:%M')}" # Si el titulo contiene caracteres peligrosos, usamos un titulo por defecto con la fecha actual

    conversacion = Conversacion(
        titulo=titulo,
        usuario_id=usuario.id
    )

    db.add(conversacion)
    db.commit()
    db.refresh(conversacion)
    db.close()

    return conversacion



# Estructura que recibe: solo el token JWT en el header Authorization
@router.get("/{conversacion_id}", response_model=ConversacionRespuesta)
def obtener_conversacion(conversacion_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    conversacion = db.query(Conversacion).filter(Conversacion.id == conversacion_id, Conversacion.usuario_id == usuario.id).first() # SELECT * FROM Conversacion WHERE id = conversacion_id AND usuario_id = usuario.id LIMIT 1
    db.close()

    if not conversacion:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    return conversacion



# Estructura que recibe: datos = { "titulo": str (opcional) }
#Este endpoint realmente no lo vamos a usar, lo dejo por si en el futuo implemento algo que lo use
@router.patch("/{conversacion_id}", response_model=ConversacionRespuesta)
def actualizar_conversacion(conversacion_id: int, datos: ConversacionActualizar, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    conversacion = db.query(Conversacion).filter(Conversacion.id == conversacion_id, Conversacion.usuario_id == usuario.id).first() # SELECT * FROM Conversacion WHERE id = conversacion_id AND usuario_id = usuario.id LIMIT 1

    if not conversacion:
        db.close()
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")


    if datos.titulo is not None:
        try:
            conversacion.titulo = sanitizar(datos.titulo)
        except ValueError:
            conversacion.titulo = f"Conversacion {datetime.now().strftime('%d/%m/%Y %H:%M')}" # Si el titulo contiene caracteres peligrosos, usamos un titulo por defecto con la fecha actual


    db.commit()
    db.refresh(conversacion)
    db.close()

    return conversacion




# Estructura que recibe: solo el token JWT en el header Authorization
@router.delete("/{conversacion_id}")
def eliminar_conversacion(conversacion_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    conversacion = db.query(Conversacion).filter(Conversacion.id == conversacion_id, Conversacion.usuario_id == usuario.id).first() # SELECT * FROM Conversacion WHERE id = conversacion_id AND usuario_id = usuario.id LIMIT 1

    if not conversacion:
        db.close()
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    db.delete(conversacion)
    db.commit()
    db.close()

    return {"mensaje": "Conversacion eliminada correctamente"}
