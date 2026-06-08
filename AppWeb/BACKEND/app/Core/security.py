from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.Core.config import settings

# Instancia de la clase CryptContext, usamos bcrypt como algoritmo para hashear contraseñas, se pueden usar funciones como .hash() o .verify()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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

    payload["exp"] = expiracion #Creamos un nuevo par clave-valor necesario para crear el token JWT y lo añadimos al payload

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# Decodifica un token JWT y devuelve su contenido, si es invalido o ha expirado devuelve None
def decodificar_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# Extrae el token del header Authorization, lo valida y devuelve el usuario de la BD
# Se usa en todos los endpoints que requieran autenticacion
def get_usuario_del_token(authorization: str):
    from app.Core.database import SessionLocal  # Importamos aqui para evitar import circular — abre sesiones con la BD
    from app.Models.Usuario import Usuario      # Importamos aqui para evitar import circular — modelo de la tabla Usuario
    from fastapi import HTTPException           # Para lanzar errores HTTP al frontend


    # El header llega como "Bearer <token>", hacemos split por el espacio y cogemos la segunda parte
    token = authorization.split(" ")[1]
    payload = decodificar_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalido o expirado")

    db = SessionLocal()
    usuario = db.query(Usuario).filter(Usuario.id == payload["id"]).first() # SELECT * FROM Usuario WHERE id = payload["id"] LIMIT 1
    db.close()

    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    return usuario
