from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.Core.config import settings

# El engine es la conexion a la base de datos, check_same__thread se usa para que se pueda usar SQLite desde varios hilos y no desde el hilo inicial que lo creo, con otra base de datos esto desaparece
engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})


# La sesion es la que abre y cierra conversaciones con la BD
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Clase base de la que heredaran todos los modelos, todas las clases heredaran de esta para que asi SQLAlchemy sepa que es una entidad de la base de datos
class Base(DeclarativeBase):
    pass
