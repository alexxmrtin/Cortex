import os
import shutil
from fastapi import APIRouter, HTTPException, Header
from app.Core.database import SessionLocal
from app.Models.Proyecto import Proyecto
from app.Schemas.ProyectoSchema import ProyectoCrear, ProyectoRespuesta, ProyectoActualizar
from app.Core.security import get_usuario_del_token
from app.Core.config import settings
from app.Helpers.Sanitizar import sanitizar
from app.Helpers.Log import log_error,log_warning
from app.Services.RAG.Ingestion import borrar_proyecto, reindexar_proyecto

router = APIRouter()

# GET    /proyectos/                → Lista todos los proyectos del usuario
# POST   /proyectos/                → Crea un nuevo proyecto
# GET    /proyectos/{id}            → Obtiene un proyecto concreto
# PATCH  /proyectos/{id}            → Actualiza nombre o descripcion
# DELETE /proyectos/{id}            → Elimina el proyecto
# POST   /proyectos/{id}/reindexar  → Reindexa en el RAG todos los archivos pertenecientes a un proyecto



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

    # El cascade="all, delete-orphan" del modelo solo borra las filas de ArchivosProyecto en la BD, no los ficheros en disco. Por eso borramos a mano la carpeta del proyecto en Storage para no dejar archivos huerfanos.
    carpeta_proyecto = os.path.join(settings.STORAGE_BASE, str(usuario.id), str(proyecto_id))
    if os.path.exists(carpeta_proyecto):
        try:
            shutil.rmtree(carpeta_proyecto)
        except Exception as e:
            log_error(f"No se pudo borrar la carpeta del proyecto {proyecto_id} en disco ({carpeta_proyecto})", e)
            db.close()
            raise HTTPException(status_code=500, detail="No se pudo eliminar el proyecto")

    db.delete(proyecto)  # el cascade borra los ArchivosProyecto y, a su vez, sus filas en ChunkArchivo
    db.commit()
    db.close()

    # Quitamos todos los vectores del proyecto en Chroma (vive fuera de la BD, el cascade no llega ahi)
    borrar_proyecto(proyecto_id)

    return {"mensaje": "Proyecto eliminado correctamente"}


# Estructura que recibe: solo el token JWT en el header Authorization
# Reindexa en el RAG todos los archivos del proyecto. Util para proyectos subidos antes de existir el RAG o para reconstruir el indice. Es sincrono: puede tardar si el proyecto tiene muchos archivos.
@router.post("/{proyecto_id}/reindexar")
def reindexar(proyecto_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id, Proyecto.usuario_id == usuario.id).first() # SELECT * FROM Proyecto WHERE id = proyecto_id AND usuario_id = usuario.id LIMIT 1
    db.close()

    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    total_chunks = reindexar_proyecto(proyecto_id, usuario.id)

    return {"mensaje": "Proyecto reindexado correctamente", "chunks_indexados": total_chunks}
