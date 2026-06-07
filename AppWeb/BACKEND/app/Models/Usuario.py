from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.Core.database import Base

class Usuario(Base):
    __tablename__ = "Usuario"

    id = Column(Integer, primary_key=True, index=True)
    nombreUsuario = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    contrasena = Column(String, nullable=False)
    fotoPerfil = Column(String, nullable=True)
    tema = Column(String, default="claro")

    # Relaciones con otras tablas
    proyectos = relationship("Proyecto", back_populates="usuario")
    servicios = relationship("Servicio", back_populates="usuario")
    conversaciones = relationship("Conversacion", back_populates="usuario")
