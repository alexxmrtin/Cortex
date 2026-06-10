import os
import aiofiles
from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from app.Core.database import SessionLocal
from app.Models.ArchivosProyecto import ArchivosProyecto
from app.Models.Proyecto import Proyecto
from app.Schemas.ArchivosProyectoSchema import ArchivoRespuesta
from app.Core.security import get_usuario_del_token

router = APIRouter()

# UploadFile → representa el archivo subido (nombre, contenido, tipo MIME)
# File(...)  → le dice a FastAPI que ese parametro viene como archivo dentro del multipart/form-data
# Form(...)  → le dice a FastAPI que ese parametro viene como campo de texto dentro del multipart/form-data
# Los tres se usan juntos cuando el frontend envia un formulario con archivos en vez de JSON


# GET    /archivos/proyecto/{proyecto_id}    → Lista todos los archivos del proyecto
# POST   /archivos/proyecto/{proyecto_id}    → Sube un archivo al proyecto
# DELETE /archivos/{archivo_id}              → Elimina un archivo del proyecto

STORAGE_BASE = "Storage/ArchivosUsuarios"  # Carpeta raiz: Storage/{usuario_id}/{proyecto_id}/



# Estructura que recibe: solo el token JWT en el header Authorization
@router.get("/proyecto/{proyecto_id}", response_model=list[ArchivoRespuesta]) #El endpoint devuelve un array de objetos del modelo ArchivoRespuesta
def obtener_archivos(proyecto_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    
    # Verificamos que el proyecto pertenece al usuario antes de listar sus archivos
    proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id, Proyecto.usuario_id == usuario.id).first() # SELECT * FROM Proyecto WHERE id = proyecto_id AND usuario_id = usuario.id LIMIT 1
    
    if not proyecto:
        db.close()
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    archivos = db.query(ArchivosProyecto).filter(ArchivosProyecto.proyecto_id == proyecto_id).all() # SELECT * FROM ArchivosProyecto WHERE proyecto_id = proyecto_id
    db.close()

    return archivos



# Estructura que recibe: archivo (multipart/form-data), rutaRelativa (form field), token en el header
# A diferencia del resto de endpoints, este recibe Form data en lugar de JSON porque sube un archivo real

# async marca la funcion como pausable, lo que permite usar await dentro. Sin async no puedes usar await
# await pausa una funcion hasta que la operacion termina, pero libera el hilo para que la API atienda otras peticiones mientras espera
# archivo: UploadFile = File(...) = El archivo que sube el usuario, File(...) le dice a FastApi que archivo viene en la  HTTP y donde se encuentra
# rutaRelativa: str = Form(...) = Ruta que se muestra en la interfaz, ej: src/index.js, Form(...) es igual que File(...)

@router.post("/proyecto/{proyecto_id}", response_model=ArchivoRespuesta)
async def subir_archivo( 
    proyecto_id: int,
    archivo: UploadFile = File(...),       
    rutaRelativa: str = Form(...),         
    authorization: str = Header(...)
):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id, Proyecto.usuario_id == usuario.id).first()
    
    if not proyecto:
        db.close()
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # Construimos la ruta completa usando rutaRelativa para respetar la estructura de carpetas original
    carpeta_destino = os.path.join(STORAGE_BASE, str(usuario.id), str(proyecto_id))
    ruta_disco = os.path.join(carpeta_destino, rutaRelativa)

    # Creamos todos los subdirectorios necesarios (ej: src/components/ dentro del proyecto)
    os.makedirs(os.path.dirname(ruta_disco), exist_ok=True)


    # Guardar el archivo en disco de forma asincrona, utilizamos la libreria aiofiles que nos permite trabajar de forma asincrona
    #"wb" significa write y binary, se abre el archivo en modo binario para escribir en el
    async with aiofiles.open(ruta_disco, "wb") as f: 
        contenido = await archivo.read() #await para esperar que termine la llamada al sistema, contenido tiene el archivo en bytes
        await f.write(contenido) #escribe el contenido del archivo, en la ruta designada

    #Y para finalizar lo vamos a insertar en la base de datos(solo ponemos los metadatos del archivo)
    nuevo_archivo = ArchivosProyecto(
        nombre=archivo.filename,
        tipo="archivo",
        rutaRelativa=rutaRelativa,
        rutaDisco=ruta_disco,
        proyecto_id=proyecto_id
    )

    db.add(nuevo_archivo)
    db.commit()
    db.refresh(nuevo_archivo)
    db.close()

    return nuevo_archivo



# Estructura que recibe: solo el token JWT en el header Authorization
@router.delete("/{archivo_id}")
def eliminar_archivo(archivo_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    
    # Hacemos un JOIN con Proyecto para verificar que el usuario es el dueño del proyecto al que pertenece el archivo
    archivo = db.query(ArchivosProyecto).join(Proyecto).filter(ArchivosProyecto.id == archivo_id,Proyecto.usuario_id == usuario.id).first() # SELECT * FROM ArchivosProyecto JOIN Proyecto ON ArchivosProyecto.proyecto_id = Proyecto.id WHERE ArchivosProyecto.id = archivo_id AND Proyecto.usuario_id = usuario.id LIMIT 1

    if not archivo:
        db.close()
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    # TODO: en el futuro mover el archivo a Cache/ en vez de borrarlo directamente, para que sea recuperable por el usuario durante un tiempo
    if archivo.rutaDisco and os.path.exists(archivo.rutaDisco):
        os.remove(archivo.rutaDisco)

    db.delete(archivo)
    db.commit()
    db.close()

    return {"mensaje": "Archivo eliminado correctamente"}
