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
    modeloIA = Column(String, default="qwen/qwen3-32b")  # Modelo de IA seleccionado por el usuario (por defecto Qwen3 32B via Groq)

    # Relaciones con otras tablas
    # cascade="all, delete-orphan" hace que al borrar un usuario, SQLAlchemy borre automaticamente todos sus proyectos, servicios y conversaciones
    proyectos = relationship("Proyecto", back_populates="usuario", cascade="all, delete-orphan")
    servicios = relationship("Servicio", back_populates="usuario", cascade="all, delete-orphan")
    conversaciones = relationship("Conversacion", back_populates="usuario", cascade="all, delete-orphan")
