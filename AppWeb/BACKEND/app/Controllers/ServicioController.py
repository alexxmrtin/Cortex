import socket
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
# GET    /servicios/{id}/ping   → Hace un ping a un servicio para ver si esta activo
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
        host=datos.host,
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

    # Para proyectoAsociado miramos si el campo VINO en la peticion (model_fields_set), no si es None.
    # Asi un null explicito (el usuario eligio "Sin proyecto") desvincula el proyecto,
    # pero un PATCH que no incluye el campo (ej: cambiar solo el estado) lo deja intacto.
    if "proyectoAsociado" in datos.model_fields_set:
        servicio.proyectoAsociado = datos.proyectoAsociado
    if datos.host is not None:
        servicio.host = datos.host
    if datos.puerto is not None:
        servicio.puerto = datos.puerto

    db.commit()
    db.refresh(servicio)
    db.close()

    return servicio


# Estructura que recibe: solo el token JWT en el header Authorization
# Intenta abrir una conexion TCP a host:puerto con un timeout de 2 segundos
# Si la conexion tiene exito (resultado == 0) el servicio esta vivo, si no, esta caido
@router.get("/{servicio_id}/ping")
def ping_servicio(servicio_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    servicio = db.query(Servicio).filter(Servicio.id == servicio_id, Servicio.usuario_id == usuario.id).first()
    db.close()

    if not servicio:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM) #Creamos un socket TCP, AF_INET (IPv4),SOCK_STREAM (TCP)
        sock.settimeout(2) #Si en dos segundos no tenemos respuesta cuando iniciamos una conexion,abandona
        
        resultado = sock.connect_ex((servicio.host, servicio.puerto)) # Aqui se inicia una conexion con el host, connect_ex devuelve 0 si conecta, otro numero si falla
        sock.close()
        
        if resultado == 0:
            vivo = True
        else:
            vivo = False
            
    except Exception:
        vivo = False

    return {"vivo": vivo}


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
