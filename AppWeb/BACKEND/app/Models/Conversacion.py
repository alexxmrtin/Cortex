from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.Core.database import Base

class Conversacion(Base):
    __tablename__ = "Conversacion"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    fechaCreacion = Column(DateTime, default=func.now())
    usuario_id = Column(Integer, ForeignKey("Usuario.id"), nullable=False)
    proyecto_id = Column(Integer, ForeignKey("Proyecto.id"), nullable=True)

    # Relaciones
    usuario = relationship("Usuario", back_populates="conversaciones")
    proyecto = relationship("Proyecto", back_populates="conversaciones")
    # cascade="all, delete-orphan" hace que al borrar una conversacion, SQLAlchemy borre automaticamente todos sus mensajes
    mensajes = relationship("Mensaje", back_populates="conversacion", cascade="all, delete-orphan")
