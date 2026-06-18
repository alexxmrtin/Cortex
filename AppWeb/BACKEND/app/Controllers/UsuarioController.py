import os
import shutil
import aiofiles
from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from app.Core.database import SessionLocal
from app.Models.Usuario import Usuario
from app.Schemas.UsuarioSchema import UsuarioCrear, UsuarioLogin, UsuarioRespuesta, UsuarioActualizar, CambiarContrasena
from app.Core.security import hashear_contrasena, verificar_contrasena, crear_token, get_usuario_del_token
from app.Helpers.Sanitizar import sanitizar
from app.Helpers.Validar import validar_contrasena, validar_nombre_usuario
from app.Helpers.Log import log_info, log_warning

STORAGE_FOTOS = "Storage/FotoPerfilUsuarios"

router = APIRouter()

# POST   /usuarios/registro          → Registra un nuevo usuario
# POST   /usuarios/login             → Inicia sesion y devuelve el token JWT
# GET    /usuarios/me                → Devuelve los datos del usuario autenticado
# PATCH  /usuarios/me                → Actualiza los datos del usuario autenticado
# PATCH  /usuarios/me/contrasena     → Cambia la contrasena del usuario autenticado
# DELETE /usuarios/me                → Elimina la cuenta del usuario autenticado


# Estructura que recibe: datos = { "nombreUsuario": str, "email": str, "contrasena": str }
@router.post("/registro", response_model=UsuarioRespuesta)
def registro(datos: UsuarioCrear):
    db = SessionLocal()

    # Sanitizar y validar datos de entrada
    try: 
        nombre = sanitizar(datos.nombreUsuario)
    except ValueError as e:
        db.close()
        raise HTTPException(status_code=400, detail=str(e)) #Mensaje que recibe el frontend: "El valor contiene caracteres no permitidos"
    
    
    if not validar_nombre_usuario(nombre):
        db.close()
        raise HTTPException(status_code=400, detail="El nombre debe tener entre 3 y 30 caracteres")
    if not validar_contrasena(datos.contrasena):
        db.close()
        raise HTTPException(status_code=400, detail="La contrasena debe tener minimo 8 caracteres, una mayuscula y un numero")

    # Comprobar que el email no esta ya registrado
    if db.query(Usuario).filter(Usuario.email == datos.email).first(): # SELECT * FROM Usuario WHERE email = datos.email LIMIT 1
        db.close()
        raise HTTPException(status_code=400, detail="El email ya esta registrado")

    # Creamos una instancia de la clase Usuario (el modelo)
    usuario = Usuario(
        nombreUsuario=nombre,
        email=datos.email,
        contrasena=hashear_contrasena(datos.contrasena)
    )
    db.add(usuario)    # Le decimos a SQLAlchemy que queremos insertar este objeto en la bd
    db.commit()        # Al hacer el commit hacemos el INSERT en la bd
    db.refresh(usuario) # Actualizamos la instancia con el id asignado por la bd
    log_info(f"Nuevo usuario registrado: {usuario.id} ({usuario.email})")
    db.close()

    return usuario


# Estructura que recibe: datos = { "email": str, "contrasena": str }
@router.post("/login")
def login(datos: UsuarioLogin):
    db = SessionLocal()

    # Buscar el usuario por email
    usuario = db.query(Usuario).filter(Usuario.email == datos.email).first() # SELECT * FROM Usuario WHERE email = datos.email LIMIT 1
    if not usuario:
        db.close()
        log_warning(f"Login fallido: no existe ningun usuario con el email {datos.email}")
        raise HTTPException(status_code=401, detail="Email incorrecto")

    # Verificar la contrasena
    if not verificar_contrasena(datos.contrasena, usuario.contrasena):
        db.close()
        log_warning(f"Login fallido: contrasena incorrecta para el email {datos.email}")
        raise HTTPException(status_code=401, detail="Contrasena incorrecta")

    db.close()

    # Crear y devolver el token JWT
    token = crear_token({"id": usuario.id})
    return {"access_token": token, "token_type": "bearer"}


# Estructura que recibe: solo el token JWT en el header Authorization
@router.get("/me", response_model=UsuarioRespuesta)
def obtener_usuario(authorization: str = Header(...)): #Header(...) le dice a FastAPI que ese parametro viene dentro de la peticion HTTP en el header

    usuario = get_usuario_del_token(authorization)
    return usuario



# Estructura que recibe: datos = { "nombreUsuario": str (opcional), "fotoPerfil": str (opcional), "tema": str (opcional) }
@router.patch("/me", response_model=UsuarioRespuesta)
def actualizar_usuario(datos: UsuarioActualizar, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    db = SessionLocal()
    usuario = db.query(Usuario).filter(Usuario.id == usuario.id).first() #al poner .first, nos esta devolviendo el usuario donde el id coincide, el cual es un objeto, usamos este objeto para modificar directamente los atributos y al hacer commit, sqlalchermy hace el UPDATE automaticamente


    if datos.nombreUsuario is not None:
        
        try: 
            nombre = sanitizar(datos.nombreUsuario)
        except ValueError as e:
            db.close()
            raise HTTPException(status_code=400, detail=str(e)) #Mensaje que recibe el frontend: "El valor contiene caracteres no permitidos"
        
        if not validar_nombre_usuario(nombre):
            db.close()
            raise HTTPException(status_code=400, detail="El nombre debe tener entre 3 y 30 caracteres")
        
        usuario.nombreUsuario = nombre
    
    if datos.fotoPerfil is not None:
        usuario.fotoPerfil = datos.fotoPerfil
    
    if datos.tema is not None:
        usuario.tema = datos.tema

    if datos.modeloIA is not None:
        usuario.modeloIA = datos.modeloIA

    db.commit()
    db.refresh(usuario)
    db.close()

    return usuario

# Este endpoint debe recibir la contrasena actual y la contrasena que quiere cambiar, si la contrasena actual es correcta, se cambia
# Estructura que recibe: datos = { "contrasenaActual": str, "contrasenaNueva": str }
@router.patch("/me/contrasena")
def cambiar_contrasena(datos: CambiarContrasena, authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    if not verificar_contrasena(datos.contrasenaActual, usuario.contrasena):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    if not validar_contrasena(datos.contrasenaNueva):
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener mínimo 8 caracteres, una mayúscula y un número")

    db = SessionLocal()
    usuario = db.query(Usuario).filter(Usuario.id == usuario.id).first()
    usuario.contrasena = hashear_contrasena(datos.contrasenaNueva)
    db.commit()
    db.close()

    return {"mensaje": "Contraseña actualizada correctamente"}


# Estructura que recibe: archivo de imagen (multipart/form-data), token en el header
@router.post("/me/foto", response_model=UsuarioRespuesta)
async def subir_foto_perfil(archivo: UploadFile = File(...), authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    carpeta = os.path.join(STORAGE_FOTOS, str(usuario.id))
    os.makedirs(carpeta, exist_ok=True)

    ruta_disco = os.path.join(carpeta, archivo.filename)
    async with aiofiles.open(ruta_disco, "wb") as f:
        contenido = await archivo.read()
        await f.write(contenido)

    url_publica = f"/storage/FotoPerfilUsuarios/{usuario.id}/{archivo.filename}"

    db = SessionLocal()
    usuario = db.query(Usuario).filter(Usuario.id == usuario.id).first()
    usuario.fotoPerfil = url_publica
    db.commit()
    db.refresh(usuario)
    db.close()

    return usuario


# Estructura que recibe: solo el token JWT en el header Authorization
@router.delete("/me")
def eliminar_usuario(authorization: str = Header(...)):
    usuario = get_usuario_del_token(authorization)

    #Al borrar un usuario, tenemos que borrar todos los archivos en disco, eso incluye la foto de perfil(lo demas lo borramos con cascade de sqlalchemy)
    carpeta_foto = os.path.join(STORAGE_FOTOS, str(usuario.id))
    if os.path.exists(carpeta_foto):
        shutil.rmtree(carpeta_foto)

    db = SessionLocal()
    usuario = db.query(Usuario).filter(Usuario.id == usuario.id).first()
    # Guardamos id y email para el log antes de borrar, porque tras el delete el objeto deja de ser accesible
    usuario_id = usuario.id
    email = usuario.email
    db.delete(usuario)
    db.commit()
    db.close()
    log_info(f"Cuenta eliminada: usuario {usuario_id} ({email})")
    return {"mensaje": "Cuenta eliminada correctamente"}
