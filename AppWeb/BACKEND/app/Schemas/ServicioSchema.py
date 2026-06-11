from pydantic import BaseModel
from datetime import datetime

# Datos que llegan cuando creas un servicio
class ServicioCrear(BaseModel):
    nombre: str
    descripcion: str | None = None
    tipo: str | None = None
    estado: str = "activo"
    proyectoAsociado: int | None = None
    host: str = "localhost"
    puerto: int

# Datos que envias al frontend cuando piden un servicio
class ServicioRespuesta(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    tipo: str | None
    estado: str
    proyectoAsociado: int | None
    host: str
    puerto: int
    fechaCreacion: datetime

    model_config = {"from_attributes": True}

# Datos que se pueden modificar
class ServicioActualizar(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    tipo: str | None = None
    estado: str | None = None
    proyectoAsociado: int | None = None
    host: str | None = None
    puerto: int | None = None
