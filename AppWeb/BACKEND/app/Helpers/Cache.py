import redis
from app.Core.config import settings

# Helper de cacheo de la aplicacion.

# IMPORTANTE: todas las funciones toleran que Redis este caido o no responda. Si algo falla, NO se lanza la excepcion hacia arriba: la app sigue funcionando como si no hubiera cache(un fallo de cache nunca debe tumbar una peticion). Por eso cada operacion va en un try/except.


# Creamos el cliente una sola vez al importar el modulo.Solo vamos a tener un cliente redis en el proceso, ya que python reutiliza el mismo cliente almacenado en cache 
# from_url no abre la conexion aqui: se conecta de forma perezosa en el primer comando, asi que importar este modulo nunca falla aunque Redis no este levantado.(Hasta que alguien usara este helper, se implementan con try/catch cosas para que la aplicacion nunca se caiga debido a redis)
# decode_responses=True hace que Redis devuelva str en vez de bytes, comodo para trabajar con texto.
cliente = redis.from_url(settings.REDIS_URL, decode_responses=True)


#Redis funciona mediante claves, cada vez que guardamos algo en cache, le vamos a pasar una clave al cliente redis ademas del dato y un ttl


# Funcion para obtener un "valor" a partir de una clave
def obtener_cache(clave: str):
    try:
        return cliente.get(clave)
    except redis.RedisError:
        return None


# Funcion para guardar en el servidor redis un "valor" usando una clave para identificarla
def guardar_cache(clave: str, valor, ttl_segundos: int = None) -> bool:
    try:
        if ttl_segundos is not None:
            cliente.set(clave, valor, ex=ttl_segundos)
        else:
            cliente.set(clave, valor)
        return True
    except redis.RedisError:
        return False


# Borramos del servidor un "valor" usando su clave vinculada
def borrar_cache(clave: str) -> bool:
    try:
        cliente.delete(clave)
        return True
    except redis.RedisError:
        return False


# Incrementa en 1 el contador guardado en 'clave' y devuelve el valor nuevo.Si la clave no existia, Redis la crea empezando en 0 (asi que la primera llamada devuelve 1).
# Si se pasa ttl_segundos SOLO se aplica la primera vez (cuando el contador vale 1 tras incrementar),para no reiniciar la expiracion en cada incremento. Pensado para limites por ventana de tiempo(p. ej. peticiones de IA por dia).
# Devuelve el valor del contador, o None si Redis no respondio.
def incrementar_cache(clave: str, ttl_segundos: int = None):
    try:
        nuevo_valor = cliente.incr(clave)
        if ttl_segundos is not None and nuevo_valor == 1:
            cliente.expire(clave, ttl_segundos)
        return nuevo_valor
    except redis.RedisError:
        return None

def decrementar_cache(clave: str):
    try:
        return cliente.decr(clave)
    except redis.RedisError:
        return None
