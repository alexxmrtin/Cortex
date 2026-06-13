from pydantic import BaseModel
from datetime import datetime

# Datos que llegan cuando el usuario envia un mensaje directamente (con rol explícito)
class MensajeCrear(BaseModel):
    contenido: str
    rol: str  # 'usuario' | 'ia'

# Datos que llegan desde el chat de IA (el rol siempre es 'usuario', lo asigna el backend)
class MensajeChatEntrada(BaseModel):
    contenido: str

# Datos que envias al frontend
class MensajeRespuesta(BaseModel):
    id: int
    contenido: str
    rol: str
    fecha: datetime

    model_config = {"from_attributes": True}
