from fastapi import APIRouter, HTTPException, Header
from app.Core.database import SessionLocal
from app.Models.Servicio import Servicio
from app.Schemas.ServicioSchema import ServicioCrear, ServicioRespuesta, ServicioActualizar
from app.Core.security import get_usuario_del_token
from app.Helpers.Sanitizar import sanitizar

router = APIRouter()

# GET    /servicios/            → Lista todos los servicios del usuario
# POST   /servicios/            → Crea un nuevo servicio
# GET    /servicios/{id}        → Obtiene un servicio concreto
# PATCH  /servicios/{id}        → Actualiza los datos del servicio
# DELETE /servicios/{id}        → Elimina el servicio


# Estructura que recibe: solo el token JWT en el header Authorization
@router.get("/", response_model=list[ServicioRespuesta])
def obtener_servicios(authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    servicios = db.query(Servicio).filter(Servicio.usuario_id == usuario.id).all() # SELECT * FROM Servicio WHERE usuario_id = usuario.id
    db.close()

    return servicios



# Estructura que recibe: datos = { "nombre": str, "puerto": int, "descripcion": str (opcional), "tipo": str (opcional),"proyectoAsociado": str (opcional) }
@router.post("/", response_model=ServicioRespuesta)
def crear_servicio(datos: ServicioCrear, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()

    try:
        nombre = sanitizar(datos.nombre)
    except ValueError as e:
        db.close()
        raise HTTPException(status_code=400, detail=str(e)) #Mensaje que recibe el frontend: "El valor contiene caracteres no permitidos"

    servicio = Servicio(
        nombre=nombre,
        descripcion=datos.descripcion,
        tipo=datos.tipo,
        proyectoAsociado=datos.proyectoAsociado,
        puerto=datos.puerto,
        usuario_id=usuario.id
    )

    db.add(servicio)
    db.commit()
    db.refresh(servicio)
    db.close()

    return servicio


# Estructura que recibe: solo el token JWT en el header Authorization
@router.get("/{servicio_id}", response_model=ServicioRespuesta)
def obtener_servicio(servicio_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    servicio = db.query(Servicio).filter(Servicio.id == servicio_id, Servicio.usuario_id == usuario.id).first() # SELECT * FROM Servicio WHERE id = servicio_id AND usuario_id = usuario.id LIMIT 1
    db.close()

    if not servicio:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    return servicio



# Estructura que recibe: datos = { "nombre": str (opcional), "descripcion": str (opcional), "tipo": str (opcional), "estado": str (opcional), "proyectoAsociado": str (opcional), "puerto": int (opcional) }
@router.patch("/{servicio_id}", response_model=ServicioRespuesta)
def actualizar_servicio(servicio_id: int, datos: ServicioActualizar, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    servicio = db.query(Servicio).filter(Servicio.id == servicio_id, Servicio.usuario_id == usuario.id).first() # SELECT * FROM Servicio WHERE id = servicio_id AND usuario_id = usuario.id LIMIT 1

    if not servicio:
        db.close()
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    if datos.nombre is not None:
        try:
            servicio.nombre = sanitizar(datos.nombre)
        except ValueError as e:
            db.close()
            raise HTTPException(status_code=400, detail=str(e)) #Mensaje que recibe el frontend: "El valor contiene caracteres no permitidos"

    if datos.descripcion is not None:
        servicio.descripcion = datos.descripcion
    if datos.tipo is not None:
        servicio.tipo = datos.tipo
    if datos.estado is not None:
        servicio.estado = datos.estado
    if datos.proyectoAsociado is not None:
        servicio.proyectoAsociado = datos.proyectoAsociado
    if datos.puerto is not None:
        servicio.puerto = datos.puerto

    db.commit()
    db.refresh(servicio)
    db.close()

    return servicio


# Estructura que recibe: solo el token JWT en el header Authorization
@router.delete("/{servicio_id}")
def eliminar_servicio(servicio_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    servicio = db.query(Servicio).filter(Servicio.id == servicio_id, Servicio.usuario_id == usuario.id).first() # SELECT * FROM Servicio WHERE id = servicio_id AND usuario_id = usuario.id LIMIT 1

    if not servicio:
        db.close()
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    db.delete(servicio)
    db.commit()
    db.close()

    return {"mensaje": "Servicio eliminado correctamente"}
