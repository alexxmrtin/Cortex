import socket
import json
from fastapi import APIRouter, HTTPException, Header
from app.Core.database import SessionLocal
from app.Models.Servicio import Servicio
from app.Schemas.ServicioSchema import ServicioCrear, ServicioRespuesta, ServicioActualizar, MetricasServicio
from app.Core.security import get_usuario_del_token
from app.Helpers.Sanitizar import sanitizar
from app.Helpers.Cifrado import cifrar
from app.Helpers.Cache import obtener_cache, guardar_cache
from app.Helpers.Log import log_error,log_warning,log_info
from app.Services.SSHService import ejecutar_comando
from app.Services.MonitorService import obtener_metricas

router = APIRouter()

# GET    /servicios/             → Lista todos los servicios del usuario
# POST   /servicios/             → Crea un nuevo servicio
# GET    /servicios/{id}         → Obtiene un servicio concreto
# PATCH  /servicios/{id}         → Actualiza los datos del servicio
# GET    /servicios/{id}/ping    → Hace un ping a un servicio para ver si esta activo
# DELETE /servicios/{id}         → Elimina el servicio
# POST   /servicios/{id}/encender → Enciende el servicio ejecutando su comandoArranque por SSH
# POST   /servicios/{id}/apagar   → Apaga el servicio ejecutando su comandoParada por SSH



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
        puertoSSH=datos.puertoSSH,
        usuarioSSH=datos.usuarioSSH,
        # La clave y la passphrase llegan en claro: las ciframos ANTES de guardarlas.
        # cifrar(None) devuelve None, asi que un servicio sin clave se guarda con NULL.
        clavePrivadaCifrada=cifrar(datos.clavePrivada),
        passphraseCifrada=cifrar(datos.passphrase),
        comandoArranque=datos.comandoArranque,
        comandoParada=datos.comandoParada,
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
    if datos.puertoSSH is not None:
        servicio.puertoSSH = datos.puertoSSH
    if datos.usuarioSSH is not None:
        servicio.usuarioSSH = datos.usuarioSSH
    if datos.comandoArranque is not None:
        servicio.comandoArranque = datos.comandoArranque
    if datos.comandoParada is not None:
        servicio.comandoParada = datos.comandoParada

    # Clave y passphrase: solo las tocamos si el campo VINO en la peticion (model_fields_set),
    # para no machacar la clave guardada cada vez que se edita otra cosa. Si viene, la ciframos.
    if "clavePrivada" in datos.model_fields_set:
        servicio.clavePrivadaCifrada = cifrar(datos.clavePrivada)
    if "passphrase" in datos.model_fields_set:
        servicio.passphraseCifrada = cifrar(datos.passphrase)

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
            
    except Exception as e:
        log_warning(f"No se pudo comprobar el servicio {servicio.id} ({servicio.host}:{servicio.puerto}): {e}")
        vivo = False

    return {"vivo": vivo}


# Segundos que cacheamos las metricas en Redis. Abrir SSH es caro, asi que llamadas seguidas
# (varias pestañas, refrescos rapidos) reutilizan la ultima muestra en vez de reconectar.
TTL_METRICAS = 10

# Devuelve las metricas del servicio: latencia (ms), CPU, RAM, disco y carga.
# Se cachea el resultado en Redis durante TTL_METRICAS segundos.
@router.get("/{servicio_id}/metricas", response_model=MetricasServicio)
def metricas_servicio(servicio_id: int, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    servicio = db.query(Servicio).filter(Servicio.id == servicio_id, Servicio.usuario_id == usuario.id).first()
    db.close()

    if not servicio:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    # 1. Intentamos servir desde cache (evita abrir SSH si hay una muestra reciente).
    clave_cache = f"metricas:{servicio_id}"
    cacheado = obtener_cache(clave_cache)
    if cacheado is not None:
        return json.loads(cacheado)

    # 2. No hay cache: medimos de verdad (esto abre la conexion SSH).
    metricas = obtener_metricas(servicio)

    # 3. Guardamos en cache para las proximas llamadas. Si Redis esta caido, guardar_cache
    #    devuelve False sin romper nada: simplemente no habria cache.
    guardar_cache(clave_cache, json.dumps(metricas), TTL_METRICAS)

    return metricas


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

#--------------------------------------------------------------------------------------------

# Funcion interna que comparten encender y apagar: busca el servicio, valida que tenga el comando pedido, lo ejecuta por SSH y, si fue bien, actualiza el estado en la BD. 'comando' es el texto a ejecutar; 'nuevo_estado' es como queda el servicio si todo va bien.
def _accion_ssh(servicio_id: int, authorization: str, atributo_comando: str, nuevo_estado: str, accion: str):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    servicio = db.query(Servicio).filter(Servicio.id == servicio_id, Servicio.usuario_id == usuario.id).first()

    if not servicio:
        db.close()
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    comando = getattr(servicio, atributo_comando)
    if not comando:
        db.close()
        raise HTTPException(status_code=400, detail=f"El servicio no tiene un comando de {accion} configurado")

    # Ejecuta el comando por SSH. Nunca lanza excepciones: devuelve un dict con el resultado.
    resultado = ejecutar_comando(servicio, comando)

    if resultado["ok"]:
        # Solo actualizamos el estado si el comando termino con exito (exit 0).
        servicio.estado = nuevo_estado
        db.commit()
        log_info(f"Usuario {usuario.id} ejecuto '{accion}' sobre el servicio {servicio.id}")
        db.close()
        return {"mensaje": f"Servicio {nuevo_estado}", "stdout": resultado["stdout"]}

    db.close()
    # 502 Bad Gateway: el fallo es de la maquina remota, no de nuestra API.
    raise HTTPException(status_code=502, detail=resultado["error"])


# Enciende el servicio ejecutando su comandoArranque por SSH. Si va bien, lo deja en 'activo'.
@router.post("/{servicio_id}/encender")
def encender_servicio(servicio_id: int, authorization: str = Header(...)):
    return _accion_ssh(servicio_id, authorization, "comandoArranque", "activo", "arranque")


# Apaga el servicio ejecutando su comandoParada por SSH. Si va bien, lo deja en 'inactivo'.
@router.post("/{servicio_id}/apagar")
def apagar_servicio(servicio_id: int, authorization: str = Header(...)):
    return _accion_ssh(servicio_id, authorization, "comandoParada", "inactivo", "parada")


#-------------------------------------------------------------------------------------------------------------------