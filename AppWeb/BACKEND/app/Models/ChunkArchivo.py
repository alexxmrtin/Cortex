from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.Core.database import Base

# Un "chunk" es un fragmento de un archivo de codigo (varias lineas) que se indexa por separado en el RAG.
# El embedding (vector) vive en Chroma; aqui guardamos el TEXTO y la metadata de cada chunk porque:
#   1. BM25 (busqueda lexica) necesita el texto plano para construir su indice en memoria.
#   2. Las citaciones necesitan saber de que archivo y de que lineas salio cada fragmento.
#   3. Permite reindexar de forma idempotente (borrar los chunks de un archivo antes de reinsertarlos).

class ChunkArchivo(Base):
    __tablename__ = "ChunkArchivo"

    id = Column(Integer, primary_key=True, index=True)
    # A que archivo pertenece el chunk. index=True porque siempre filtramos/borramos por archivo_id
    archivo_id = Column(Integer, ForeignKey("ArchivosProyecto.id"), nullable=False, index=True)
    # Duplicamos proyecto_id y usuario_id (aunque se podrian deducir via JOIN) para filtrar BM25 por proyecto sin joins y para el aislamiento por usuario
    proyecto_id = Column(Integer, ForeignKey("Proyecto.id"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("Usuario.id"), nullable=False, index=True)
    indice = Column(Integer, nullable=False)       # Posicion del chunk dentro del archivo (0, 1, 2...). Con archivo_id forma el id determinista "archivo_id:indice" en Chroma
    texto = Column(Text, nullable=False)           # Contenido del fragmento (puede ser largo, por eso Text y no String)
    linea_inicio = Column(Integer, nullable=False) # Primera linea del archivo que cubre el chunk (para citaciones)
    linea_fin = Column(Integer, nullable=False)    # Ultima linea del archivo que cubre el chunk (para citaciones)
    lenguaje = Column(String, nullable=True)       # Lenguaje deducido de la extension (python, javascript...), util para filtrar y para el prompt

    # Relaciones
    archivo = relationship("ArchivosProyecto", back_populates="chunks")
