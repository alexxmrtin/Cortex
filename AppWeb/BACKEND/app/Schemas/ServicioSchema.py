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
    # --- Acceso SSH (todo opcional: un servicio puede no gestionarse por SSH) ---
    puertoSSH: int = 22
    usuarioSSH: str | None = None
    # OJO: aqui la clave y la passphrase llegan EN CLARO desde el frontend. El controlador
    # las cifra con cifrar() antes de guardarlas. En la BD nunca se guarda el texto plano.
    clavePrivada: str | None = None
    passphrase: str | None = None
    comandoArranque: str | None = None
    comandoParada: str | None = None

# Datos que envias al frontend cuando piden un servicio
# IMPORTANTE: NO incluye la clave privada ni la passphrase (ni cifradas). Solo exponemos
# 'tieneClaveSSH' para que el frontend sepa si esta configurada, sin poder leerla nunca.
class ServicioRespuesta(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    tipo: str | None
    estado: str
    proyectoAsociado: int | None
    host: str
    puerto: int
    puertoSSH: int | None
    usuarioSSH: str | None
    comandoArranque: str | None
    comandoParada: str | None
    tieneClaveSSH: bool
    fechaCreacion: datetime

    model_config = {"from_attributes": True}

# Metricas de monitorizacion de un servicio. Cualquier campo puede ser None si no se pudo
# obtener (sin SSH, maquina caida, comando fallido...). 'sshOk' indica si las metricas de la
# maquina (CPU/RAM/disco/carga) se leyeron bien; la latencia se mide aparte y puede venir sola.
class MetricasServicio(BaseModel):
    latenciaMs: float | None
    cpuPorcentaje: float | None
    ramTotalMb: int | None
    ramUsadaMb: int | None
    ramPorcentaje: float | None
    discoPorcentaje: int | None
    carga1: float | None
    carga5: float | None
    carga15: float | None
    sshOk: bool
    error: str | None

# Datos que se pueden modificar
class ServicioActualizar(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    tipo: str | None = None
    estado: str | None = None
    proyectoAsociado: int | None = None
    host: str | None = None
    puerto: int | None = None
    puertoSSH: int | None = None
    usuarioSSH: str | None = None
    clavePrivada: str | None = None
    passphrase: str | None = None
    comandoArranque: str | None = None
    comandoParada: str | None = None
