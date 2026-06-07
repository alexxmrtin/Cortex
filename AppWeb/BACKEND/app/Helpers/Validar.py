import re

# Valida que la contrasena tenga al menos 8 caracteres, una mayuscula y un numero
def validar_contrasena(contrasena: str) -> bool:
    if len(contrasena) < 8:
        return False
    if not re.search(r"[A-Z]", contrasena):
        return False
    if not re.search(r"[0-9]", contrasena):
        return False
    return True

# Valida que el nombre de usuario tenga entre 3 y 30 caracteres
def validar_nombre_usuario(nombre: str) -> bool:
    if len(nombre) < 3 or len(nombre) > 30:
        return False
    return True

