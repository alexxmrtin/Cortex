import os
from datetime import datetime


def log_error_servicio(servicio: str, error: Exception):
    carpeta = f"Logs/ServicesLogs/{servicio}Logs"
    os.makedirs(carpeta, exist_ok=True)

    ruta = f"{carpeta}/{servicio.lower()}.txt"
    linea = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ERROR: {str(error)}\n"

    with open(ruta, "a") as f:
        f.write(linea)
