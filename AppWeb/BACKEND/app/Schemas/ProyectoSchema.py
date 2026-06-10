from pydantic import BaseModel
from datetime import datetime

#Datos que llegan cuando creas un proyecto
class ProyectoCrear(BaseModel):
    nombreproyecto: str
    descripcion: str | None = None

#Datos que envias al frontend cuando piden un proyecto
class ProyectoRespuesta(BaseModel):
    id: int
    nombreproyecto: str
    descripcion: str | None
    fechaCreacion: datetime
    
    model_config = {"from_attributes": True}

#Datos que se pueden modificar
class ProyectoActualizar(BaseModel):
    nombreproyecto: str | None = None
    descripcion: str | None = None

