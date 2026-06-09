from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.Core.database import engine, Base  # engine es la conexion a la BD, Base es la clase de la que heredan los modelos
from app.MiddleWares.CORS import configurar_cors
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

