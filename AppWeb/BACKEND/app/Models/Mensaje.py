from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.Core.database import Base

class Mensaje(Base):
    __tablename__ = "Mensaje"

    id = Column(Integer, primary_key=True, index=True)
    contenido = Column(Text, nullable=False)
    rol = Column(String, nullable=False)          # 'usuario' | 'ia'
    fecha = Column(DateTime, default=func.now())
    conversacion_id = Column(Integer, ForeignKey("Conversacion.id"), nullable=False)

    # Relaciones
    conversacion = relationship("Conversacion", back_populates="mensajes")
