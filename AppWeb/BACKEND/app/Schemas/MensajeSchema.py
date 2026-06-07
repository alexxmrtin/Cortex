from pydantic import BaseModel
from datetime import datetime

# Datos que llegan cuando el usuario envia un mensaje
class MensajeCrear(BaseModel):
    contenido: str
    rol: str  # 'usuario' | 'ia'

# Datos que envias al frontend
class MensajeRespuesta(BaseModel):
    id: int
    contenido: str
    rol: str
    fecha: datetime

    model_config = {"from_attributes": True}
