from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.Core.database import Base

class ArchivosProyecto(Base):
    __tablename__ = "ArchivosProyecto"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    tipo = Column(String, nullable=False)       # 'archivo' | 'carpeta'
    rutaRelativa = Column(String, nullable=False)  # ruta dentro del proyecto, ej: src/index.js, lo que se muestra al usuario en la interfaz
    rutaDisco = Column(String, nullable=True)      # ruta absoluta en el servidor
    proyecto_id = Column(Integer, ForeignKey("Proyecto.id"), nullable=False)

    # Relaciones
    proyecto = relationship("Proyecto", back_populates="archivos")
