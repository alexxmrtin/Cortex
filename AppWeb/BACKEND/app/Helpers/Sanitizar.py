import re #libreria de expresiones regulares de python

def sanitizar(valor: str) -> str:
    # Elimina espacios al inicio y al final
    valor = valor.strip()

    # Elimina caracteres especiales, solo permite letras, numeros, espacios y guiones
    if (valor != re.sub(r"[^\w\s\-]", "", valor)):
        raise ValueError("El valor contiene caracteres no permitidos")

    return valor
