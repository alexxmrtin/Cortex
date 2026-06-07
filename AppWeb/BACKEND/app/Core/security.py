from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.Core.config import settings
from app.Core.database import get_db

# Instancia de la clase CryptContext, usamos bcrypt como algoritmo para hashear contraseñas, se pueden usar funciones como .hash() o .verify()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Instancia las cual usamos para leer el token Bearer que envia el frontend
bearer_scheme = HTTPBearer()


# Recibe la contraseña en texto plano y devuelve su hash para guardar en la BD
def hashear_contrasena(contrasena: str) -> str:
    return pwd_context.hash(contrasena)


# Compara la contraseña en texto plano con el hash guardado en la BD, devuelve True si coinciden
def verificar_contrasena(contrasena: str, contrasena_hasheada: str) -> bool:
    return pwd_context.verify(contrasena, contrasena_hasheada)


# Crea un token JWT con los datos del usuario y una fecha de expiracion
def crear_token(datos: dict) -> str:
    payload = datos.copy() #Copia los datos en otra variable
    
    expiracion = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES) #Definimos el tiempo de uso que tiene el token JWT, definimos ese tiempo en el .env
    
    payload["exp"] = expiracion #Creamos un nuevo par clave-valor necesario para crear el token JWT
    
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)



# Decodifica un token JWT y devuelve su contenido, si es invalido o ha expirado devuelve None
def decodificar_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None



# Dependencia de FastAPI que extrae el token del header, lo valida y devuelve el usuario autenticado
# Se usa con Depends() en los endpoints que requieran autenticacion
def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),  # extrae el token del header Authorization
    db: Session = Depends(get_db) #Depends(get_db) le dice a FastAPI que te abra una sesion en la base de datos y la inyecte en la variable db
):
    from app.Models.Usuario import Usuario #Necesario importar dentro de la funcion

    payload = decodificar_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalido o expirado")

    # Una vez validado el usuario con el token JWT, buscamos el usuario en la base de datos
    
    usuario = db.query(Usuario).filter(Usuario.id == int(payload["id"])).first() # SELECT * FROM Usuario WHERE id = payload["id"] LIMIT 1
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    return usuario

