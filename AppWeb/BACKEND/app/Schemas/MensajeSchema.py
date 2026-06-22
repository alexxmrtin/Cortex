from pydantic import BaseModel
from datetime import datetime

# Datos que llegan cuando el usuario envia un mensaje directamente (con rol explícito)
class MensajeCrear(BaseModel):
    contenido: str
    rol: str  # 'usuario' | 'ia'

# Datos que llegan desde el chat de IA (el rol siempre es 'usuario', lo asigna el backend)
class MensajeChatEntrada(BaseModel):
    contenido: str

# Una fuente: de que archivo y lineas salio un trozo del contexto usado para responder (para citaciones)
class FuenteRespuesta(BaseModel):
    rutaRelativa: str
    archivo_id: int
    linea_inicio: int
    linea_fin: int

# Datos que envias al frontend
class MensajeRespuesta(BaseModel):
    id: int
    contenido: str
    rol: str
    fecha: datetime
    # Fuentes del RAG usadas para la respuesta (vacio si la conversacion no esta ligada a un proyecto).
    # El frontend lo usara para mostrar citaciones clicables; es opcional/compatible hacia atras.
    fuentes: list[FuenteRespuesta] = []

    model_config = {"from_attributes": True}
