#CORS (Cross-Origin Resource Sharing) es un mecanismo de seguridad del navegador que bloquea peticiones entre dominios distintos.
#Por ejemplo, tu frontend está en http://localhost:5173 y tu backend en http://localhost:8000. Para el navegador son dominios distintos, así que por defecto bloquea cualquier petición del frontend al backend.


from fastapi.middleware.cors import CORSMiddleware #FastAPI nos proporciona un middleware con el que podemos configurarlo facilmente

# Origenes permitidos, añadir aqui las URLs del frontend
origenes = [
    "http://localhost:5173",  # Frontend en desarrollo
]

def configurar_cors(app):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origenes,       # quien puede hacer peticiones
        allow_credentials=True,        # permite enviar cookies y headers de autenticacion
        allow_methods=["*"],           # permite todos los metodos HTTP (GET, POST, PATCH...)
        allow_headers=["*"],           # permite todos los headers
    )
