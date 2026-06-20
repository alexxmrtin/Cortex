import socket
import time
from app.Services.SSHService import ejecutar_comando
from app.Helpers.Log import log_warning

# Servicio de monitorizacion de un servicio remoto.
#
# Junta dos fuentes de datos distintas:
#   1. Metricas DE DENTRO de la maquina (CPU, RAM, disco, carga) -> se leen por SSH.
#   2. Latencia de red al puerto del servicio -> se mide desde el backend, NO por SSH.
#
# Importante sobre el coste: abrir una conexion SSH es caro (handshake completo). Por eso pedimos TODAS las metricas de la maquina con UN SOLO comando combinado (una conexion), en vez de una conexion por metrica. El controlador, ademas, cachea el resultado en Redis.


# Comando unico que se ejecuta por SSH. Lee de /proc (estable entre distros) y de df.
# Cada bloque va precedido de una marca '#XXX' para poder trocear la salida al parsear. Las dos lecturas de /proc/stat (separadas por 'sleep 1') sirven para calcular el % de CPU por diferencia: el porcentaje de CPU es una tasa, necesita dos muestras en el tiempo.
_COMANDO_METRICAS = (
    "echo '#CPU1'; head -n1 /proc/stat; "
    "sleep 1; "
    "echo '#CPU2'; head -n1 /proc/stat; "
    "echo '#MEM'; grep -E '^MemTotal:|^MemAvailable:' /proc/meminfo; "
    "echo '#DISK'; df -P / | tail -n1; "
    "echo '#LOAD'; cat /proc/loadavg"
)


# Mide el tiempo (en ms) que tarda en establecerse una conexion TCP a host:puerto. Es la "latencia" de cara al usuario: cuanto tarda el servicio en aceptar una conexion. Devuelve los ms (float) si conecta, o None si no responde / hay error.
def medir_latencia(host: str, puerto: int) -> float | None:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        inicio = time.perf_counter()                 # reloj monotono, no se ve afectado por cambios de hora
        resultado = sock.connect_ex((host, puerto))   # 0 si conecta
        fin = time.perf_counter()
        sock.close()

        if resultado == 0:
            return round((fin - inicio) * 1000, 2)    # segundos -> ms, con 2 decimales
        return None
    except Exception as e:
        log_warning(f"No se pudo medir la latencia de {host}:{puerto}: {e}")
        return None


# Trocea la salida del comando en secciones usando las marcas '#XXX'. Devuelve un dict { 'CPU1': [lineas], 'MEM': [lineas], ... }.
def _trocear_secciones(salida: str) -> dict:
    secciones = {}
    actual = None
    for linea in salida.splitlines():
        if linea.startswith("#"):
            actual = linea[1:].strip()
            secciones[actual] = []
        elif actual is not None:
            secciones[actual].append(linea)
    return secciones


# Calcula el % de CPU a partir de las dos lecturas de /proc/stat. La linea 'cpu' trae: user nice system idle iowait irq softirq steal ... % uso = (trabajo_hecho_entre_muestras) / (tiempo_total_entre_muestras) * 100
def _calcular_cpu(linea1: str, linea2: str) -> float | None:
    try:
        campos1 = [int(x) for x in linea1.split()[1:]]   # quitamos la etiqueta 'cpu'
        campos2 = [int(x) for x in linea2.split()[1:]]

        idle1 = campos1[3] + campos1[4]   # idle + iowait (la CPU no hacia nada util)
        idle2 = campos2[3] + campos2[4]
        total1 = sum(campos1)
        total2 = sum(campos2)

        total_delta = total2 - total1
        idle_delta = idle2 - idle1

        if total_delta <= 0:
            return None

        uso = (total_delta - idle_delta) / total_delta * 100
        return round(uso, 1)
    except (ValueError, IndexError):
        return None


# Parsea las dos lineas de /proc/meminfo (MemTotal y MemAvailable, en kB). Devuelve (total_mb, usada_mb, porcentaje) o (None, None, None) si no se pudo.
def _calcular_ram(lineas: list) -> tuple:
    try:
        valores = {}
        for linea in lineas:
            clave, resto = linea.split(":")
            valores[clave.strip()] = int(resto.strip().split()[0])   # el numero en kB

        total_kb = valores["MemTotal"]
        disponible_kb = valores["MemAvailable"]
        usada_kb = total_kb - disponible_kb

        total_mb = round(total_kb / 1024)
        usada_mb = round(usada_kb / 1024)
        porcentaje = round(usada_kb / total_kb * 100, 1)
        return (total_mb, usada_mb, porcentaje)
    except (ValueError, IndexError, KeyError, ZeroDivisionError):
        return (None, None, None)


# Saca el % de uso del disco de la linea de 'df -P /'. Formato: Filesystem 1024-blocks Used Available Capacity Mounted-on  -> el % es el 5o campo.
def _calcular_disco(lineas: list) -> int | None:
    try:
        campos = lineas[0].split()
        return int(campos[4].replace("%", ""))
    except (ValueError, IndexError):
        return None


# Saca el load average de 1, 5 y 15 minutos de /proc/loadavg.
def _calcular_carga(lineas: list) -> tuple:
    try:
        partes = lineas[0].split()
        return (float(partes[0]), float(partes[1]), float(partes[2]))
    except (ValueError, IndexError):
        return (None, None, None)


# Punto de entrada: obtiene todas las metricas de un servicio. Devuelve un dict listo para serializar. Cada metrica puede ser None si no se pudo obtener.
def obtener_metricas(servicio) -> dict:
    # La latencia se mide siempre (no depende de SSH).
    metricas = {
        "latenciaMs": medir_latencia(servicio.host, servicio.puerto),
        "cpuPorcentaje": None,
        "ramTotalMb": None,
        "ramUsadaMb": None,
        "ramPorcentaje": None,
        "discoPorcentaje": None,
        "carga1": None,
        "carga5": None,
        "carga15": None,
        "sshOk": False,
        "error": None,
    }

    # Sin credenciales SSH no podemos leer CPU/RAM/disco: devolvemos solo la latencia.
    if not servicio.usuarioSSH or not servicio.clavePrivadaCifrada:
        metricas["error"] = "El servicio no tiene credenciales SSH configuradas"
        return metricas

    resultado = ejecutar_comando(servicio, _COMANDO_METRICAS)
    if not resultado["ok"]:
        metricas["error"] = resultado["error"]
        return metricas

    secciones = _trocear_secciones(resultado["stdout"])

    if "CPU1" in secciones and "CPU2" in secciones and secciones["CPU1"] and secciones["CPU2"]:
        metricas["cpuPorcentaje"] = _calcular_cpu(secciones["CPU1"][0], secciones["CPU2"][0])

    if "MEM" in secciones:
        total_mb, usada_mb, porcentaje = _calcular_ram(secciones["MEM"])
        metricas["ramTotalMb"] = total_mb
        metricas["ramUsadaMb"] = usada_mb
        metricas["ramPorcentaje"] = porcentaje

    if "DISK" in secciones:
        metricas["discoPorcentaje"] = _calcular_disco(secciones["DISK"])

    if "LOAD" in secciones:
        carga1, carga5, carga15 = _calcular_carga(secciones["LOAD"])
        metricas["carga1"] = carga1
        metricas["carga5"] = carga5
        metricas["carga15"] = carga15

    metricas["sshOk"] = True
    return metricas
