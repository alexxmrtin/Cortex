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
- 🛡️ **Límites de uso** — máximo 50 peticiones de IA por usuario al día (contador en Redis que se reinicia solo cada día) y 20 conversaciones por usuario (la más antigua se elimina al superar el límite).
- ⚡ **Caché con Redis** — contador del límite diario de IA y caché del estado de salud del modelo, para evitar consultas y llamadas de pago repetidas.
- 📋 **Logging** — registro centralizado (módulo `logging`) con niveles, rotación de ficheros y un manejador global que captura cualquier error no controlado.

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
│   │   │   ├── Helpers/       # Validación, sanitización, caché (Redis) y logging
│   │   │   └── MiddleWares/   # Configuración de CORS
│   │   ├── Storage/      # Archivos subidos por los usuarios (en disco)
│   │   ├── Logs/         # Log general (cortex.log) + logs por servicio de IA
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
| **Caché**    | Redis (cliente `redis`) — contador del límite diario y caché del *health* del modelo |
| **Logging**  | Módulo `logging` de la librería estándar (niveles + rotación de ficheros) |

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
REDIS_URL=redis://localhost:6379/0
STORAGE_BASE=Storage/ArchivosUsuarios
```

> **Redis** debe estar corriendo para que funcionen el contador del límite diario y la caché del *health* (`redis-server` en local). Si Redis no está disponible, la app **no se rompe**: simplemente deja de cachear y el límite diario no se aplica (los helpers toleran que Redis esté caído).

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

## ⚡ Caché con Redis

El backend usa **Redis** (almacén clave-valor en memoria) para datos que se consultan mucho y que cuesta producir. Toda la lógica se centraliza en el helper [`app/Helpers/Cache.py`](AppWeb/BACKEND/app/Helpers/Cache.py), que envuelve al cliente `redis` y expone funciones cómodas:

| Función | Qué hace |
|---------|----------|
| `obtener_cache(clave)` | Lee un valor (o `None` si no existe / Redis no responde) |
| `guardar_cache(clave, valor, ttl_segundos)` | Guarda con expiración opcional |
| `borrar_cache(clave)` | Invalida una clave |
| `incrementar_cache(clave, ttl_segundos)` | `+1` atómico; el TTL solo se fija la primera vez (contadores) |
| `decrementar_cache(clave)` | `-1` atómico (deshacer un incremento) |

> **Tolerancia a fallos:** todas las funciones van en `try/except`. Si Redis está caído, devuelven `None`/no hacen nada y **la app sigue funcionando** sin caché. Un fallo de Redis nunca tumba una petición.

**Usos actuales:**

1. **Contador del límite diario de IA** — en cada chat se hace `incrementar_cache("ia:peticiones:{usuario_id}:{YYYY-MM-DD}", 86400)`. La clave lleva la fecha, así cada día usa una clave distinta y el límite **se reinicia solo** al cambiar de día (TTL de 24 h). Al superar el tope se rechaza la petición con un `429` (y se decrementa el contador para no consumir cupo). Sustituye al antiguo `COUNT(*)` contra la base de datos.
2. **Caché del *health* del modelo** — `GET /mensajes/health` hace una llamada real (de pago) a la API del proveedor. El resultado se cachea **15 s** con clave por modelo (`health:modelo:{modeloIA}`), de modo que un único chequeo se reutiliza para todos los usuarios durante ese tiempo.

La conexión se configura con `REDIS_URL` en el `.env` (cliente único compartido en todo el proceso, conexión perezosa). En **local** apunta a `redis://localhost:6379/0` (requiere `redis-server` corriendo); en **Docker** hay un contenedor `redis` propio y `docker-compose.yml` sobreescribe la variable a `redis://redis:6379/0`.

---

## 📋 Logging

El registro se centraliza en el helper [`app/Helpers/Log.py`](AppWeb/BACKEND/app/Helpers/Log.py), construido sobre el módulo **`logging`** de la librería estándar (no requiere dependencia en `requirements.txt`). Aporta **niveles**, **rotación de ficheros** (5 MB × 3 copias) y salida simultánea a **fichero y consola**, con formato unificado:

```
2026-06-18 12:03:57 | ERROR | cortex | Error no controlado en GET /_boom: explosion de prueba
```

**Funciones disponibles:**

| Función | Nivel | Uso |
|---------|-------|-----|
| `log_info(mensaje)` | INFO | eventos de auditoría/negocio |
| `log_warning(mensaje)` | WARNING | anomalías y fallos de cliente (no son bugs del servidor) |
| `log_error(mensaje, error=None)` | ERROR | errores reales; si se pasa la excepción, vuelca el *traceback* |
| `log_error_servicio(servicio, error)` | ERROR | fallos de los proveedores de IA (fichero por servicio) |

**Destino de los logs** (carpeta `Logs/`):
- `Logs/cortex.log` → log general de la aplicación.
- `Logs/ServicesLogs/{Servicio}Logs/{servicio}.txt` → un fichero por servicio de IA (Claude/Gemini/Groq).

**Manejador global de errores** — registrado en `main.py` con `@app.exception_handler(Exception)`: captura **cualquier excepción no controlada** de cualquier endpoint (los `500` reales), la registra con método + ruta + *traceback*, y devuelve un `500` limpio sin filtrar el *stacktrace* al cliente. Las `HTTPException` intencionadas (404, 400, 429…) las sigue gestionando FastAPI aparte.

**Eventos registrados actualmente:**

| Evento | Nivel | Dónde |
|--------|-------|-------|
| Registro de usuario | INFO | `UsuarioController` |
| Cuenta eliminada | INFO | `UsuarioController` |
| Límite diario de IA alcanzado | INFO | `MensajeController` |
| Login fallido (email o contraseña) | WARNING | `UsuarioController` |
| Token mal formado / inválido / usuario inexistente | WARNING | `security.py` |
| BD↔disco descuadrados / servicio con host:puerto inválido | WARNING | `ArchivoProyecto` / `ServicioController` |
| Fallo al leer/subir archivo, fallo al borrar proyecto | ERROR | `ArchivoProyecto` / `ProyectoController` |
| Fallo de un proveedor de IA | ERROR | `Services/*` |
| Cualquier excepción no controlada (500) | ERROR | manejador global en `main.py` |

> **Seguridad:** nunca se registran contraseñas ni tokens; solo el hecho del fallo y, como mucho, el email o el `id` de usuario.

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

---

## 🌓 Tema claro / oscuro

El tema se implementa con **variables CSS (custom properties)**. Los CSS Modules no usan colores literales sino tokens (`var(--c-*)`), cuyos valores se redefinen según el tema activo. Alternar de tema no recarga estilos: únicamente cambia un atributo en la raíz del documento.

**Definición de tokens — `src/index.css`.** Los valores del tema claro se declaran en `:root` y los del oscuro en `[data-theme="dark"]`, que por especificidad sobreescribe a los primeros cuando el atributo está presente en `<html>`:

```css
:root               { --c-surface: #ffffff; --c-text: #333333; --c-border: #c0bfc2; /* ... */ }
[data-theme="dark"] { --c-surface: #20222a; --c-text: #e7e7ea; --c-border: #353842; /* ... */ }
```

Los módulos de estilo consumen estos tokens (`color: var(--c-text)`, `background: var(--c-surface)`…). Los colores de estado (error/peligro) y los botones con texto blanco se mantienen literales para preservar el contraste en ambos temas.

**Selección — `Ajustes` › Apariencia.** La preferencia se aplica, se persiste y se sincroniza con el backend:

```js
document.documentElement.setAttribute('data-theme', 'dark'); // aplica (removeAttribute para claro)
localStorage.setItem('tema', 'oscuro');                      // persistencia en el navegador
await apiClient.patch('/usuarios/me', { tema: 'oscuro' });   // preferencia del usuario
```

**Inicialización — `src/main.jsx`.** El tema almacenado se reaplica antes del primer render, de forma global a toda la aplicación, evitando el *flash* de tema incorrecto:

```js
if (localStorage.getItem('tema') === 'oscuro') {
  document.documentElement.setAttribute('data-theme', 'dark')
}
```

`localStorage` actúa como fuente de verdad para aplicar el tema en cliente; el campo `tema` del usuario conserva la preferencia en servidor.


