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

    class Config:
        env_file = ".env"

#Finalmente instanciamos la clase en el objeto settings, llamaremos a este objeto cada vez que necesitemos algo del .env
settings = Settings()
