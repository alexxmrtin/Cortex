from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.Core.database import Base

class ArchivosProyecto(Base):
    __tablename__ = "ArchivosProyecto"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    rutaRelativa = Column(String, nullable=False)  # ruta dentro del proyecto, ej: src/index.js, lo que se muestra al usuario en la interfaz
    rutaDisco = Column(String, nullable=True)      # ruta absoluta en el servidor
    proyecto_id = Column(Integer, ForeignKey("Proyecto.id"), nullable=False)

    # Relaciones
    proyecto = relationship("Proyecto", back_populates="archivos")
    # Chunks del RAG generados a partir de este archivo. cascade="all, delete-orphan" hace que al borrar el archivo
    # se borren sus filas de ChunkArchivo automaticamente (los vectores de Chroma se borran aparte en el controlador).
    chunks = relationship("ChunkArchivo", back_populates="archivo", cascade="all, delete-orphan")
