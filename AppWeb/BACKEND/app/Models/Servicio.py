from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.Core.database import Base

class Servicio(Base):
    __tablename__ = "Servicio"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(Text, nullable=True)
    tipo = Column(String, nullable=True)
    estado = Column(String, default="activo")     # 'activo' | 'inactivo'
    proyectoAsociado = Column(String, nullable=False)
    puerto = Column(Integer, nullable=False)
    fechaCreacion = Column(DateTime, default=func.now())
    usuario_id = Column(Integer, ForeignKey("Usuario.id"), nullable=False)

    # Relaciones
    usuario = relationship("Usuario", back_populates="servicios")
