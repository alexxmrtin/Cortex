import os
import logging
from logging.handlers import RotatingFileHandler

# Modulo de logging de la aplicacion.(Usamos la libreria logging)

# Por encima del modulo "logging" estandar de Python, exponemos funciones comodas en español (log_info, log_advertencia, log_error...) para que el resto del codigo no tenga que saber como esta configurado el logging por dentro.



# Carpeta raiz donde viven todos los logs (relativa al directorio desde el que se arranca uvicorn,que es BACKEND/; en Docker esa carpeta esta montada como volumen para que los logs persistan).
CARPETA_LOGS = "Logs"

# Formato comun de cada linea -> "2026-06-18 12:30:01 | ERROR | cortex | mensaje"
_FORMATO = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
_FORMATO_FECHA = "%Y-%m-%d %H:%M:%S"

# Umbral por defecto: se ignora todo lo que este por debajo (los DEBUG).
_NIVEL = logging.INFO

# Rotacion: cada fichero crece hasta 5 MB y guardamos las 3 ultimas copias historicas.
_MAX_BYTES = 5 * 1024 * 1024
_COPIAS = 3




# Crea (o reutiliza) un logger que escribe en consola y en un fichero rotativo. logging.getLogger devuelve SIEMPRE el mismo objeto para el mismo nombre, asi que comprobamos si ya tiene handlers para no añadirlos dos veces (pasaria con el reload de uvicorn o con varios imports).
def _crear_logger(nombre: str, ruta_fichero: str) -> logging.Logger:
    logger = logging.getLogger(nombre)

    if logger.handlers:
        return logger

    logger.setLevel(_NIVEL)
    logger.propagate = False  # evitamos que el mensaje suba al logger raiz y se duplique

    formatter = logging.Formatter(_FORMATO, datefmt=_FORMATO_FECHA)

    # Nos aseguramos de que exista la carpeta del fichero antes de escribir en el
    os.makedirs(os.path.dirname(ruta_fichero), exist_ok=True)

    # Handler a fichero, con rotacion para que no crezca sin limite
    handler_fichero = RotatingFileHandler(ruta_fichero, maxBytes=_MAX_BYTES, backupCount=_COPIAS, encoding="utf-8")
    handler_fichero.setFormatter(formatter)
    logger.addHandler(handler_fichero)

    # Handler a consola, para verlo en la terminal al levantar uvicorn
    handler_consola = logging.StreamHandler()
    handler_consola.setFormatter(formatter)
    logger.addHandler(handler_consola)

    return logger


# Logger general de la aplicacion -> Logs/cortex.log
_logger_app = _crear_logger("cortex", f"{CARPETA_LOGS}/cortex.log")


# ---------------------------------------------------------------------------
# Funciones comodas para el resto del codigo. Cada una corresponde a un nivel.
# ---------------------------------------------------------------------------

# Evento informativo normal (login correcto, alta de proyecto, limite alcanzado...).
def log_info(mensaje: str):
    _logger_app.info(mensaje)


# Algo que no es un fallo pero conviene vigilar (token expirado, validacion rechazada...).
def log_warning(mensaje: str):
    _logger_app.warning(mensaje)


# Un error. Si se pasa la excepcion en 'error', ademas del mensaje se vuelca el traceback completo
# (exc_info) para poder depurar donde y por que salto.
def log_error(mensaje: str, error: Exception = None):
    if error is not None:
        _logger_app.error(f"{mensaje}: {error}", exc_info=error)
    else:
        _logger_app.error(mensaje)


# ---------------------------------------------------------------------------
# Compatibilidad: logs por servicio de IA (Claude/Gemini/Groq).
# ---------------------------------------------------------------------------
def log_error_servicio(servicio: str, error: Exception):
    ruta = f"{CARPETA_LOGS}/ServicesLogs/{servicio}Logs/{servicio.lower()}.txt"
    logger = _crear_logger(f"cortex.servicio.{servicio.lower()}", ruta)
    logger.error(f"Fallo en el servicio {servicio}: {error}", exc_info=error)
