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

    # Relaciones
    usuario = relationship("Usuario", back_populates="conversaciones")
    mensajes = relationship("Mensaje", back_populates="conversacion")
