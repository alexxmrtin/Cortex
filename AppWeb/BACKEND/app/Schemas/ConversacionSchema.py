from pydantic import BaseModel
from datetime import datetime

# Datos que llegan cuando creas una conversacion
class ConversacionCrear(BaseModel):
    titulo: str
    proyecto_id: int | None = None

# Datos que envias al frontend cuando piden una conversacion
class ConversacionRespuesta(BaseModel):
    id: int
    titulo: str
    fechaCreacion: datetime
    proyecto_id: int | None = None

    model_config = {"from_attributes": True}

# Datos que se pueden modificar
class ConversacionActualizar(BaseModel):
    titulo: str | None = None
