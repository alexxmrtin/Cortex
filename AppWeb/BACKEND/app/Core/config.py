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
    ENCRYPTION_KEY: str  # Clave Fernet (base64) para cifrar/descifrar credenciales SSH en la BD.
    STORAGE_BASE: str = "Storage/ArchivosUsuarios" # Carpeta raiz donde se guardan los archivos en disco: STORAGE_BASE/{usuario_id}/{proyecto_id}/

    # ---RAG (Centro de IA)---
    RAG_PERSIST_DIR: str = "Storage/ChromaDB"  # Carpeta donde Chroma persiste la base vectorial (dentro del volumen Storage en Docker)
    EMBEDDING_MODEL: str = "BAAI/bge-m3"  # Modelo de embeddings local (multilingue). El MISMO se usa para indexar documentos y para vectorizar consultas
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"  # Cross-encoder local que reordena los resultados recuperados (top-k -> top-n)
    RAG_TOP_K: int = 50  # Cuantos chunks se recuperan en bruto (vectorial + BM25) antes de reordenar
    RAG_TOP_N: int = 8   # Cuantos chunks quedan tras el reranking y se inyectan en el prompt

    class Config:
        env_file = ".env"

#Finalmente instanciamos la clase en el objeto settings, llamaremos a este objeto cada vez que necesitemos algo del .env
settings = Settings()
