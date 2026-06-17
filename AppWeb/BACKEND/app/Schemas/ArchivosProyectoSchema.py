from pydantic import BaseModel

# Datos que envias al frontend para mostrar el arbol de archivos
class ArchivoRespuesta(BaseModel):
    id: int
    nombre: str
    rutaRelativa: str

    model_config = {"from_attributes": True}

#Datos que envias al frontend para mostrar el archivo
class ArchivoContenido(BaseModel):
    nombre: str
    rutaRelativa: str
    contenido: str
