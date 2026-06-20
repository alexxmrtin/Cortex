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
    proyectoAsociado = Column(Integer, ForeignKey("Proyecto.id"), nullable=True)
    host = Column(String, default="localhost", nullable=False)  # direccion donde corre el servicio , por default sera localhost
    puerto = Column(Integer, nullable=False)


    # --- Datos de acceso SSH para encender/apagar el servicio en la maquina remota ---
    puertoSSH = Column(Integer, default=22, nullable=True)   # puerto SSH, por defecto el 22
    usuarioSSH = Column(String, nullable=True)    # usuario con el que se abre la sesion SSH (ej: "root")
    clavePrivadaCifrada = Column(Text, nullable=True)# La clave privada SSH se guarda SIEMPRE cifrada (Fernet), nunca en claro. Se descifra solo en el momento de conectar.
    passphraseCifrada = Column(Text, nullable=True) # Passphrase de la clave privada, tambien cifrada. Opcional porque no todas las claves llevan passphrase.

    # Comandos que se ejecutan por SSH para encender y apagar el servicio (ej: "systemctl start nginx").
    # Son libres para soportar cualquier forma de gestion (systemctl, docker, scripts...).
    comandoArranque = Column(Text, nullable=True)
    comandoParada = Column(Text, nullable=True)


    fechaCreacion = Column(DateTime, default=func.now())
    usuario_id = Column(Integer, ForeignKey("Usuario.id"), nullable=False)

    # Relaciones
    usuario = relationship("Usuario", back_populates="servicios")

    # Esto es una propiedad calculada, es una funcion que se comporta como si fuera un atributo: indica si el servicio tiene clave SSH guardada, SIN exponer la clave en si. Se usa en ServicioRespuesta.
    @property
    def tieneClaveSSH(self) -> bool:
        return self.clavePrivadaCifrada is not None
