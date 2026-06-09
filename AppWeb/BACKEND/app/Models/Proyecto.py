from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.Core.database import Base

class Proyecto(Base):
    __tablename__ = "Proyecto"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(Text, nullable=True)
    fechaCreacion = Column(DateTime, default=func.now())
    usuario_id = Column(Integer, ForeignKey("Usuario.id"), nullable=False)

    # Relaciones
    usuario = relationship("Usuario", back_populates="proyectos")
    # cascade="all, delete-orphan" hace que al borrar un proyecto, SQLAlchemy borre automaticamente todos sus archivos
    archivos = relationship("ArchivosProyecto", back_populates="proyecto", cascade="all, delete-orphan")
