from cryptography.fernet import Fernet, InvalidToken
from app.Core.config import settings

# Helper de cifrado simetrico para credenciales sensibles (claves privadas SSH, passphrases...).
#
# Usamos Fernet: cifrado simetrico (la MISMA clave cifra y descifra) basado en AES.
# La clave vive en el .env (ENCRYPTION_KEY) y NUNCA se guarda en el repo ni en la BD.
# En la BD solo se guarda el texto cifrado; el texto en claro existe solo en memoria
# durante el instante justo de usarlo (p. ej. al abrir la conexion SSH).

# Creamos el objeto Fernet una sola vez al importar el modulo, a partir de la clave del .env.
fernet = Fernet(settings.ENCRYPTION_KEY)


# Recibe un texto en claro y devuelve su version cifrada (str) lista para guardar en la BD.
# Si le pasan None (campo opcional, p. ej. una clave sin passphrase) devuelve None tal cual.
def cifrar(texto_plano: str | None) -> str | None:
    if texto_plano is None:
        return None

    # Fernet trabaja con bytes: codificamos a UTF-8 antes de cifrar y decodificamos el
    # resultado a str para poder guardarlo comodamente en una columna de texto.
    token = fernet.encrypt(texto_plano.encode("utf-8"))
    return token.decode("utf-8")


# Recibe el texto cifrado que sacamos de la BD y devuelve el texto en claro original.
# Si le pasan None devuelve None. Si el token es invalido o fue cifrado con OTRA clave
# (p. ej. cambiaron ENCRYPTION_KEY), Fernet lanza InvalidToken y devolvemos None para
# no tumbar la peticion; quien llame debe tratar ese None como "credencial no disponible".
def descifrar(texto_cifrado: str | None) -> str | None:
    if texto_cifrado is None:
        return None

    try:
        texto_plano = fernet.decrypt(texto_cifrado.encode("utf-8"))
        return texto_plano.decode("utf-8")
    except InvalidToken:
        return None
