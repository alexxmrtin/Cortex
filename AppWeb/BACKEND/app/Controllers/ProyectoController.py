from fastapi import APIRouter, HTTPException, Header
from app.Core.database import SessionLocal
from app.Models.Proyecto import Proyecto
from app.Schemas.ProyectoSchema import ProyectoCrear, ProyectoRespuesta, ProyectoActualizar
from app.Core.security import get_usuario_del_token
from app.Helpers.Sanitizar import sanitizar

router = APIRouter()

# GET    /proyectos/            → Lista todos los proyectos del usuario
# POST   /proyectos/            → Crea un nuevo proyecto
# GET    /proyectos/{id}        → Obtiene un proyecto concreto
# PATCH  /proyectos/{id}        → Actualiza nombre o descripcion
# DELETE /proyectos/{id}        → Elimina el proyecto



# Estructura que recibe: solo el token JWT en el header Authorization
@router.get("/", response_model=list[ProyectoRespuesta])
def obtener_proyectos(authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    proyectos = db.query(Proyecto).filter(Proyecto.usuario_id == usuario.id).all() # SELECT * FROM Proyecto WHERE usuario_id = usuario.id
    db.close()

    return proyectos



# Estructura que recibe: datos = { "nombreproyecto": str, "descripcion": str (opcional) }
@router.post("/", response_model=ProyectoRespuesta)
def crear_proyecto(datos: ProyectoCrear, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()

    try: 
        nombreProyecto = sanitizar(datos.nombreproyecto)
    except ValueError as e:
        db.close()
        raise HTTPException(status_code=400, detail=str(e)) #Mensaje que recibe el frontend: "El valor contiene caracteres no permitidos"

    proyecto = Proyecto(
        nombreproyecto=nombreProyecto,
        descripcion=datos.descripcion,
        usuario_id=usuario.id
    )

    db.add(proyecto)
    db.commit()
    db.refresh(proyecto)
    db.close()

    return proyecto



# Estructura que recibe: solo el token JWT en el header Authorization
@router.get("/{proyecto_id}", response_model=ProyectoRespuesta)
def obtener_proyecto(proyecto_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id, Proyecto.usuario_id == usuario.id).first() # SELECT * FROM Proyecto WHERE id = proyecto_id AND usuario_id = usuario.id LIMIT 1
    db.close()

    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return proyecto



# Estructura que recibe: datos = { "nombreproyecto": str (opcional), "descripcion": str (opcional) }
@router.patch("/{proyecto_id}", response_model=ProyectoRespuesta)
def actualizar_proyecto(proyecto_id: int, datos: ProyectoActualizar, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id, Proyecto.usuario_id == usuario.id).first() # SELECT * FROM Proyecto WHERE id = proyecto_id AND usuario_id = usuario.id LIMIT 1

    if not proyecto:
        db.close()
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if datos.nombreproyecto is not None:

        try:
            proyecto.nombreproyecto = sanitizar(datos.nombreproyecto)
        except ValueError as e:
            db.close()
            raise HTTPException(status_code=400, detail=str(e)) #Mensaje que recibe el frontend: "El valor contiene caracteres no permitidos"
        
    if datos.descripcion is not None:
        proyecto.descripcion = datos.descripcion

    db.commit()
    db.refresh(proyecto)
    db.close()

    return proyecto


# Estructura que recibe: solo el token JWT en el header Authorization
@router.delete("/{proyecto_id}")
def eliminar_proyecto(proyecto_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id, Proyecto.usuario_id == usuario.id).first() # SELECT * FROM Proyecto WHERE id = proyecto_id AND usuario_id = usuario.id LIMIT 1

    if not proyecto:
        db.close()
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    db.delete(proyecto)
    db.commit()
    db.close()

    return {"mensaje": "Proyecto eliminado correctamente"}
