from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.Core.config import settings

# El engine es la conexion a la base de datos (PostgreSQL).
engine = create_engine(settings.DATABASE_URL)


# La sesion es la que abre y cierra conversaciones con la BD
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Clase base de la que heredaran todos los modelos, todas las clases heredaran de esta para que asi SQLAlchemy sepa que es una entidad de la base de datos
class Base(DeclarativeBase):
    pass
