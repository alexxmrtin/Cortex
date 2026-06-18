from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from app.Core.database import engine, Base  # engine es la conexion a la BD, Base es la clase de la que heredan los modelos
from app.MiddleWares.CORS import configurar_cors
from app.Helpers.Log import log_error
import app.Models  # Importa todos los modelos para que SQLAlchemy los registre antes de crear las tablas

# Importar los routers de cada controlador
from app.Controllers.UsuarioController import router as usuario_router
from app.Controllers.ProyectoController import router as proyecto_router
from app.Controllers.ServicioController import router as servicio_router
from app.Controllers.ConversacionController import router as conversacion_router
from app.Controllers.MensajeController import router as mensaje_router
from app.Controllers.ArchivoProyectoController import router as archivo_router

app = FastAPI()

# Registrar el middleware de CORS
configurar_cors(app)


# Manejador GLOBAL de errores no controlados.
# FastAPI gestiona aparte las HTTPException (404, 400...) que lanzamos a proposito, asi que estehandler SOLO salta con excepciones que NO hemos previsto (los 500 reales: bugs, fallos de BD, etc.).
@app.exception_handler(Exception)
async def manejador_global_errores(request: Request, exc: Exception):
    log_error(f"Error no controlado en {request.method} {request.url.path}", exc)
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})



# Crear las tablas en la BD al arrancar si no existen
Base.metadata.create_all(bind=engine)

# Exponer la carpeta Storage como archivos estáticos accesibles desde /storage
app.mount("/storage", StaticFiles(directory="Storage"), name="storage")

# Registrar los routers con sus prefijos de URL
app.include_router(usuario_router, prefix="/usuarios")
app.include_router(proyecto_router, prefix="/proyectos")
app.include_router(servicio_router, prefix="/servicios")
app.include_router(conversacion_router, prefix="/conversaciones")
app.include_router(mensaje_router, prefix="/mensajes")
app.include_router(archivo_router, prefix="/archivos")

