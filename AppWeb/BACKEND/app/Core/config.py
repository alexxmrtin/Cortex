from pydantic_settings import BaseSettings

#Usamos pydantic_settings para que lea el .env y rellene automaticamente los parametros en la clase
class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    GEMINI_API_KEY: str
    ANTHROPIC_API_KEY: str
    GROQ_API_KEY: str
    REDIS_URL: str  #redis es un miniservidor que creas en tu aplicacion con una base de datos noSQL, actualmente usa por defecto a el puerto 6379 del mismo host y el backend lo usa por ese puerto
    ENCRYPTION_KEY: str  # Clave Fernet (base64) para cifrar/descifrar credenciales SSH en la BD. Es un secreto: vive en el .env, nunca en el repo.
    # Carpeta raiz donde se guardan los archivos en disco: STORAGE_BASE/{usuario_id}/{proyecto_id}/
    # Lleva valor por defecto (no es un secreto, es una ruta) para que la app arranque aunque no este en el .env.
    STORAGE_BASE: str = "Storage/ArchivosUsuarios"

    class Config:
        env_file = ".env"

#Finalmente instanciamos la clase en el objeto settings, llamaremos a este objeto cada vez que necesitemos algo del .env
settings = Settings()
