# 🧠 Cortex

> Plataforma web para **gestionar tus proyectos de software y servicios**, con un asistente de **IA integrado** capaz de leer los archivos de tus proyectos y explicártelos.

Cortex te permite subir proyectos completos (carpetas con su estructura de archivos), registrar los servicios asociados a cada uno, y conversar con distintos modelos de IA que utilizan **tus propios archivos como contexto** para responder con precisión sobre tu código.

---

## ✨ Características

- 🔐 **Autenticación con JWT** — registro, login y gestión de perfil (foto, tema, contraseña).
- 📁 **Gestión de proyectos** — sube carpetas completas conservando su estructura de directorios; los archivos se almacenan en disco y se indexan en la base de datos.
- 🌳 **Explorador de archivos** — el árbol de carpetas se reconstruye a partir de las rutas relativas y se navega de forma recursiva.
- ⚙️ **Gestión de servicios** — registra servicios asociados a tus proyectos (tipo, puerto, estado) con un endpoint de *ping* para comprobar su disponibilidad.
- 🤖 **Centro de IA (RAG)** — chatea con la IA usando los archivos de un proyecto como contexto. El backend detecta qué archivos menciona tu pregunta y se los pasa al modelo.
- 🔀 **Multi-modelo** — elige entre **Gemini 2.0 Flash** (Google), **Claude Sonnet 4.6** (Anthropic) o **Llama 3.3 70B** (Groq). El modelo activo se guarda por usuario.
- 💬 **Historial persistente** — las conversaciones se guardan en la base de datos y se reenvían completas al modelo en cada llamada, para mantener el contexto entre sesiones.
- 🛡️ **Límites de uso** — máximo 30 peticiones de IA por usuario al día y 20 conversaciones por usuario (la más antigua se elimina al superar el límite).

---

## 🏗️ Arquitectura

Cortex está dividido en dos aplicaciones independientes dentro de `AppWeb/`:

```
Cortex/
├── AppWeb/
│   ├── BACKEND/          # API REST con FastAPI
│   │   ├── app/
│   │   │   ├── Controllers/   # Endpoints (routers) de cada recurso
│   │   │   ├── Core/          # Configuración, base de datos y seguridad (JWT)
│   │   │   ├── Models/        # Modelos SQLAlchemy (tablas)
│   │   │   ├── Schemas/       # Schemas Pydantic (validación/serialización)
│   │   │   ├── Services/      # Integraciones con Gemini, Claude y Groq
│   │   │   ├── Helpers/       # Validación, sanitización y logging
│   │   │   └── MiddleWares/   # Configuración de CORS
│   │   ├── Storage/      # Archivos subidos por los usuarios (en disco)
│   │   ├── Logs/         # Logs de errores de los servicios de IA
│   │   ├── cortex.db     # Base de datos SQLite
│   │   ├── main.py       # Punto de entrada de la API
│   │   └── requirements.txt
│   └── FRONTEND/         # SPA con React + Vite
│       └── src/
│           ├── components/    # Componentes reutilizables (Header, Footer, Calendar...)
│           ├── pages/         # Páginas (Home, Login, Proyectos, Servicios, CentroIA...)
│           ├── services/      # Cliente Axios con interceptor de token
│           ├── hooks/         # Hooks personalizados (useApi)
│           └── styles/        # CSS Modules
└── README.md
```

### Stack tecnológico

| Capa         | Tecnologías |
|--------------|-------------|
| **Frontend** | React 19, React Router 7, Vite 8, Axios, Lucide React, React Markdown |
| **Backend**  | FastAPI, Uvicorn, SQLAlchemy 2, Pydantic Settings |
| **Auth**     | JWT (python-jose) + hashing de contraseñas con bcrypt (passlib) |
| **IA**       | `google-genai` (Gemini), `anthropic` (Claude), `groq` (Llama) |
| **BD**       | SQLite (migración a PostgreSQL prevista) |

---

## 🚀 Puesta en marcha

### Requisitos previos

- **Python 3.10+**
- **Node.js 18+** y npm
- Claves API de los proveedores de IA que quieras usar (Gemini, Anthropic y/o Groq).

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd Cortex
```

### 2. Backend (FastAPI)

```bash
cd AppWeb/BACKEND

# Crear y activar un entorno virtual
python -m venv .venv
source .venv/bin/activate        # En Windows: .venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Edita .env y rellena SECRET_KEY y tus claves API
```

Contenido de `.env`:

```env
DATABASE_URL=sqlite:///./cortex.db
SECRET_KEY=tu_clave_secreta
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
GEMINI_API_KEY=tu_api_key
ANTHROPIC_API_KEY=tu_api_key
GROQ_API_KEY=tu_api_key
```

Arrancar el servidor (las tablas se crean automáticamente al iniciar):

```bash
uvicorn main:app --reload
```

La API quedará disponible en **http://localhost:8000** y la documentación interactiva en **http://localhost:8000/docs**.

### 3. Frontend (React + Vite)

```bash
cd AppWeb/FRONTEND

# Instalar dependencias
npm install

# (Opcional) configurar la URL de la API
cp .env.example .env.local
# Por defecto el cliente apunta a http://localhost:8000
```

Para apuntar a otra URL, define la variable en `.env.local`:

```env
VITE_API_URL=http://localhost:8000
```

Arrancar en modo desarrollo:

```bash
npm run dev
```

La aplicación quedará disponible en **http://localhost:5173**.

#### Scripts disponibles

```bash
npm run dev       # Servidor de desarrollo con hot reload
npm run build     # Compilar para producción
npm run preview   # Previsualizar el build de producción
npm run lint      # Analizar el código con ESLint
```

---

## 🤖 Cómo funciona la IA (RAG)

Cuando una conversación está vinculada a un proyecto, en cada mensaje el backend selecciona qué archivos darle al modelo como contexto siguiendo esta lógica:

1. **Detección por mención** — parte el mensaje del usuario en palabras y busca archivos del proyecto cuyo nombre (con o sin extensión) coincida exactamente con alguna de ellas.
2. **Cola de contexto acumulado** — los IDs de los archivos usados se guardan en la conversación (campo `archivos_contexto`, un CSV) para que el contexto se mantenga a lo largo de la conversación. La cola tiene un **tope de 10 archivos**: al superarlo se descartan los más antiguos.
3. **README perpetuo** — el `README.txt` del proyecto se añade **siempre**, al margen de la cola, de modo que el tope de 10 nunca lo expulsa.
4. **Orden de prioridad** — al gastar el presupuesto de caracteres, los archivos se ordenan así:
   1. Los mencionados en el mensaje **actual** (nunca se quedan fuera).
   2. El **README** del proyecto.
   3. El resto de la cola acumulada, del más reciente al más antiguo.
5. **Presupuesto de caracteres por modelo** — el contenido se carga en orden de prioridad hasta un tope que depende del modelo activo, para no superar su límite de tokens (Groq devuelve error 413 con peticiones grandes). Lo que no cabe se recorta o se queda fuera (lo menos prioritario):

   | Modelo | Presupuesto de contexto |
   |--------|-------------------------|
   | Llama 3.3 70B (Groq) | 30 000 caracteres |
   | Gemini 2.0 Flash / Claude Sonnet 4.6 | 60 000 caracteres |

6. **Construcción del `system_prompt`** — con los archivos seleccionados se construye el prompt de sistema y se envía al servicio del modelo activo del usuario. Si no se encontró ningún archivo, se instruye a la IA para que pida al usuario el nombre exacto del archivo.

Tras la respuesta, tanto el mensaje del usuario como el de la IA se guardan en la base de datos.

> Como ningún modelo recuerda conversaciones entre llamadas, **todo el historial se reenvía en cada petición** para mantener la coherencia.

---

## 📡 API REST

Base: `http://localhost:8000`

### 👤 Usuarios — `/usuarios`
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/registro` | Registrar un nuevo usuario |
| `POST` | `/login` | Iniciar sesión y obtener un token JWT |
| `GET`  | `/me` | Datos del usuario autenticado |
| `PATCH`| `/me` | Actualizar perfil |
| `PATCH`| `/me/contrasena` | Cambiar contraseña |
| `POST` | `/me/foto` | Subir foto de perfil |
| `DELETE`| `/me` | Eliminar la cuenta |

### 📁 Proyectos — `/proyectos`
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/` | Listar proyectos del usuario |
| `POST` | `/` | Crear un proyecto |
| `GET`  | `/{id}` | Obtener un proyecto |
| `PATCH`| `/{id}` | Actualizar un proyecto |
| `DELETE`| `/{id}` | Eliminar un proyecto |

### 📄 Archivos de proyecto — `/archivos`
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/proyecto/{proyecto_id}` | Listar archivos de un proyecto |
| `POST` | `/proyecto/{proyecto_id}` | Subir un archivo (FormData) |
| `DELETE`| `/{archivo_id}` | Eliminar un archivo |

### ⚙️ Servicios — `/servicios`
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/` | Listar servicios |
| `POST` | `/` | Crear un servicio |
| `GET`  | `/{id}` | Obtener un servicio |
| `PATCH`| `/{id}` | Actualizar un servicio |
| `GET`  | `/{id}/ping` | Comprobar disponibilidad del servicio |
| `DELETE`| `/{id}` | Eliminar un servicio |

### 💬 Conversaciones — `/conversaciones`
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/` | Listar conversaciones |
| `POST` | `/` | Crear una conversación (opcionalmente vinculada a un proyecto) |
| `GET`  | `/{id}` | Obtener una conversación |
| `PATCH`| `/{id}` | Actualizar una conversación |
| `DELETE`| `/{id}` | Eliminar una conversación |

### 🗨️ Mensajes — `/mensajes`
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/health` | Estado del servicio de mensajes |
| `GET`  | `/conversacion/{id}` | Listar mensajes de una conversación |
| `POST` | `/conversacion/{id}/chat` | Enviar mensaje y obtener respuesta de la IA |
| `DELETE`| `/{id}` | Eliminar un mensaje |

---

## 🗃️ Modelo de datos

| Entidad | Campos principales |
|---------|--------------------|
| **Usuario** | `id`, `nombreUsuario`, `email`, `contrasena` (hash), `fotoPerfil`, `tema`, `modeloIA` |
| **Proyecto** | `id`, `nombreproyecto`, `descripcion`, `fechaCreacion`, `usuario_id` |
| **ArchivosProyecto** | `id`, `nombre`, `rutaRelativa`, `rutaDisco`, `proyecto_id` |
| **Servicio** | `id`, `nombre`, `descripcion`, `tipo`, `estado`, `proyectoAsociado`, `puerto`, `fechaCreacion`, `usuario_id` |
| **Conversacion** | `id`, `titulo`, `fechaCreacion`, `usuario_id`, `proyecto_id`, `archivos_contexto` (CSV de IDs de archivos usados como contexto) |
| **Mensaje** | `id`, `contenido`, `rol` (`usuario`/`ia`), `fecha`, `conversacion_id` |


