from pydantic import BaseModel
from datetime import datetime

# Datos que llegan cuando creas una conversacion
class ConversacionCrear(BaseModel):
    titulo: str

# Datos que envias al frontend cuando piden una conversacion
class ConversacionRespuesta(BaseModel):
    id: int
    titulo: str
    fechaCreacion: datetime

    model_config = {"from_attributes": True}

# Datos que se pueden modificar
class ConversacionActualizar(BaseModel):
    titulo: str | None = None
