import io
import paramiko
from app.Helpers.Cifrado import descifrar
from app.Helpers.Log import log_info, log_warning, log_error

# Servicio de ejecucion remota por SSH.
#
# Esto es toda la logica de paramiko: descifrar la clave privada del servicio, abrir la conexion SSH a la maquina y ejecutar un comando. El controlador solo llama ejecutar_comando() y recibe un resultado estructurado; no toca paramiko directamente.

# Timeouts (en segundos) para que una maquina caida o lenta no deje la peticion colgada.
TIMEOUT_CONEXION = 10   # tiempo maximo para establecer la conexion TCP/SSH
TIMEOUT_COMANDO = 30    # tiempo maximo esperando a que termine el comando

# Tipos de clave SSH que soportamos. Probamos uno a uno hasta que alguno cargue la clave, porque a partir del PEM no sabemos de antemano si es RSA, Ed25519 o ECDSA.
_TIPOS_CLAVE = [paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey]


# Intenta cargar la clave privada (en texto PEM) probando cada tipo soportado. Devuelve el objeto PKey de paramiko, o None si ningun tipo la reconocio(PEM corrupto, passphrase incorrecta, formato no soportado...).
def _cargar_clave_privada(pem: str, passphrase: str | None):
    for tipo in _TIPOS_CLAVE:
        try:
            return tipo.from_private_key(io.StringIO(pem), password=passphrase)
        except paramiko.SSHException:
            # Este tipo no es: probamos el siguiente.
            continue
    return None




# Ejecuta un comando por SSH en la maquina del servicio.

# Recibe el objeto Servicio (de donde saca host, puertoSSH, usuarioSSH y las credenciales cifradas) y la cadena del comando a ejecutar. 
# Descifra la clave SOLO aqui, en memoria, el tiempo justo de conectar. Nunca lanza excepciones hacia arriba ni loguea la clave: devuelve siempre un diccionario con el resultado para que el controlador decida la respuesta HTTP.

# Devuelve: { "ok": bool, "exit_code": int | None, "stdout": str, "stderr": str, "error": str | None }
#   - ok           -> True si se conecto, ejecuto el comando y este termino con codigo 0.
#   - exit_code    -> codigo de salida del comando remoto (0 = exito), o None si no llego a ejecutarse.
#   - stdout/stderr-> salida del comando.
#   - error        -> mensaje legible si algo fallo antes o durante la ejecucion; None si todo fue bien.

def ejecutar_comando(servicio, comando: str) -> dict:
    # Validamos que el servicio tenga lo minimo para conectarse por SSH.
    if not servicio.usuarioSSH or not servicio.clavePrivadaCifrada:
        return {"ok": False, "exit_code": None, "stdout": "", "stderr": "",
                "error": "El servicio no tiene credenciales SSH configuradas"}

    # Desciframos las credenciales. Si la clave esta corrupta o se cifro con otra ENCRYPTION_KEY, descifrar() devuelve None y no podemos continuar.
    clave_pem = descifrar(servicio.clavePrivadaCifrada)
    passphrase = descifrar(servicio.passphraseCifrada)  # None si el servicio no tenia passphrase

    if clave_pem is None:
        log_error(f"No se pudo descifrar la clave SSH del servicio {servicio.id} (ENCRYPTION_KEY cambiada o dato corrupto)")
        return {"ok": False, "exit_code": None, "stdout": "", "stderr": "",
                "error": "No se pudo descifrar la clave SSH del servicio"}

    clave = _cargar_clave_privada(clave_pem, passphrase)
    if clave is None:
        return {"ok": False, "exit_code": None, "stdout": "", "stderr": "",
                "error": "La clave privada SSH no es valida o la passphrase es incorrecta"}

    puerto_ssh = servicio.puertoSSH or 22

    cliente = paramiko.SSHClient()
    # AutoAddPolicy acepta la huella del servidor la primera vez sin verificarla contra un known_hosts. Es comodo para una herramienta propia, pero implica que NO detectamos un posible man-in-the-middle. Si en el futuro se quiere endurecer, aqui se cargaria un known_hosts y se usaria RejectPolicy.
    cliente.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        cliente.connect(
            hostname=servicio.host,
            port=puerto_ssh,
            username=servicio.usuarioSSH,
            pkey=clave,
            timeout=TIMEOUT_CONEXION,
            allow_agent=False,      # no usamos el agente SSH local del backend
            look_for_keys=False,    # ni buscamos claves en ~/.ssh: usamos solo la que nos dan
        )

        # exec_command devuelve los tres flujos. recv_exit_status() bloquea hasta que el comando termina, asi obtenemos su codigo de salida real.
        _stdin, stdout, stderr = cliente.exec_command(comando, timeout=TIMEOUT_COMANDO)
        exit_code = stdout.channel.recv_exit_status()
        salida = stdout.read().decode("utf-8", errors="replace").strip()
        error_salida = stderr.read().decode("utf-8", errors="replace").strip()

        if exit_code == 0:
            log_info(f"Comando SSH ejecutado en servicio {servicio.id} ({servicio.host}): exit 0")
            return {"ok": True, "exit_code": 0, "stdout": salida, "stderr": error_salida, "error": None}

        # El comando se ejecuto pero devolvio un codigo de error (p. ej. la unidad no existe).
        log_warning(f"Comando SSH en servicio {servicio.id} ({servicio.host}) termino con exit {exit_code}: {error_salida}")
        return {"ok": False, "exit_code": exit_code, "stdout": salida, "stderr": error_salida,
                "error": f"El comando termino con codigo {exit_code}"}

    except paramiko.AuthenticationException:
        log_warning(f"Autenticacion SSH fallida en servicio {servicio.id} ({servicio.host}) con usuario {servicio.usuarioSSH}")
        return {"ok": False, "exit_code": None, "stdout": "", "stderr": "",
                "error": "Autenticacion SSH fallida: revisa el usuario y la clave"}

    except Exception as e:
        # Fallos de red, host inalcanzable, timeout, etc. Logueamos el detalle tecnico pero
        # devolvemos un mensaje generico (sin exponer internals al frontend).
        log_error(f"Error al ejecutar comando SSH en servicio {servicio.id} ({servicio.host})", e)
        return {"ok": False, "exit_code": None, "stdout": "", "stderr": "",
                "error": "No se pudo conectar con la maquina remota"}

    finally:
        cliente.close()
