from pydantic import BaseModel, EmailStr

# Datos que llegan cuando el usuario se registra
class UsuarioCrear(BaseModel):
    nombreUsuario: str
    email: EmailStr
    contrasena: str

# Datos que llegan cuando el usuario inicia sesion
class UsuarioLogin(BaseModel):
    email: EmailStr
    contrasena: str

# Datos que se devuelven al frontend (nunca la contrasena)
class UsuarioRespuesta(BaseModel):
    id: int
    nombreUsuario: str
    email: str
    fotoPerfil: str | None #El campo es necesario enviarlo, aunque sea con None
    tema: str

    model_config = {"from_attributes": True} # Permite a Pydantic leer datos directamente de un objeto SQLAlchemy, sin esto esperaria un diccionario y daria error

# Datos que se pueden modificar en ajustes
class UsuarioActualizar(BaseModel):
    nombreUsuario: str | None = None #El campo es opcional enviarlo
    fotoPerfil: str | None = None
    tema: str | None = None

# Datos que se reciben para cambiar la contrasena
class CambiarContrasena(BaseModel):
    contrasenaActual: str
    contrasenaNueva: str
