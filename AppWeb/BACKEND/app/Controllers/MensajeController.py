from fastapi import APIRouter, HTTPException, Header
from app.Core.database import SessionLocal
from app.Models.Mensaje import Mensaje
from app.Models.Conversacion import Conversacion
from app.Schemas.MensajeSchema import MensajeCrear, MensajeRespuesta
from app.Core.security import get_usuario_del_token

router = APIRouter()

# GET    /mensajes/conversacion/{id}    → Lista todos los mensajes de una conversacion
# POST   /mensajes/conversacion/{id}    → Envia un mensaje en una conversacion
# DELETE /mensajes/{id}                 → Elimina un mensaje


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



# Estructura que recibe: datos = { "contenido": str, "rol": str }
@router.post("/conversacion/{conversacion_id}", response_model=MensajeRespuesta)
def crear_mensaje(conversacion_id: int, datos: MensajeCrear, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()

    # Verificamos que la conversacion pertenece al usuario antes de insertar el mensaje
    conversacion = db.query(Conversacion).filter(Conversacion.id == conversacion_id, Conversacion.usuario_id == usuario.id).first() # SELECT * FROM Conversacion WHERE id = conversacion_id AND usuario_id = usuario.id LIMIT 1
    
    if not conversacion:
        db.close()
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    if datos.rol not in ("usuario", "ia"):
        db.close()
        raise HTTPException(status_code=400, detail="El rol debe ser 'usuario' o 'ia'")

    mensaje = Mensaje(
        contenido=datos.contenido,
        rol=datos.rol,
        conversacion_id=conversacion_id
    )

    db.add(mensaje)
    db.commit()
    db.refresh(mensaje)
    db.close()

    return mensaje



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
