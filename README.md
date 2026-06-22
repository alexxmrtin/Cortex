# 🧠 Cortex

> Plataforma web para **gestionar tus proyectos de software y servicios**, con un asistente de **IA integrado** capaz de leer los archivos de tus proyectos y explicártelos.

Cortex te permite subir proyectos completos (carpetas con su estructura de archivos), registrar los servicios asociados a cada uno, y conversar con distintos modelos de IA que utilizan **tus propios archivos como contexto** para responder con precisión sobre tu código.

---

## ✨ Características

- 🔐 **Autenticación con JWT** — registro, login y gestión de perfil (foto, tema, contraseña).
- 📁 **Gestión de proyectos** — sube carpetas completas conservando su estructura de directorios; los archivos se almacenan en disco y se indexan en la base de datos.
- 🌳 **Explorador de archivos** — el árbol de carpetas se reconstruye a partir de las rutas relativas y se navega de forma recursiva.
- ⚙️ **Gestión de servicios** — registra servicios asociados a tus proyectos (tipo, puerto, estado) con un endpoint de *ping* para comprobar su disponibilidad.
- 🔌 **Encendido/apagado por SSH** — arranca y para servicios remotos ejecutando comandos por SSH en su máquina. Las credenciales SSH se guardan **cifradas** (Fernet) y nunca se exponen.
- 📊 **Monitorización en vivo** — panel por servicio con latencia, uso de CPU/RAM/disco y carga del sistema, leídos por SSH (más la latencia medida desde el backend) y cacheados en Redis.
- 🤖 **Centro de IA** — chatea con distintos modelos de IA. *(El motor de contexto de proyectos está en proceso de reimplementación.)*
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
| **SSH**      | `paramiko` (cliente SSH) + `cryptography` (cifrado Fernet de las credenciales) |
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
ENCRYPTION_KEY=tu_clave_fernet   # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
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

## 🤖 Cómo funciona la IA

Cada mensaje se envía al modelo activo del usuario (Gemini, Claude o Groq) junto con **todo el historial** de la conversación, ya que ningún modelo recuerda conversaciones entre llamadas. Tras la respuesta, tanto el mensaje del usuario como el de la IA se guardan en la base de datos.

> 🚧 El motor de contexto de proyectos (RAG) se ha retirado y está **en proceso de reimplementación**. Por ahora la IA responde solo con el historial de la conversación, sin inyectar archivos del proyecto.

---

## 🔌 Control de servicios por SSH

Además de comprobar si un servicio está vivo (*ping* TCP), Cortex permite **encenderlo y apagarlo de forma remota**. El backend abre una conexión **SSH** contra la máquina donde corre el servicio y ejecuta allí el comando que el usuario haya definido (`systemctl start nginx`, `docker stop api`, un script propio…). Toda la lógica de SSH se centraliza en el servicio [`app/Services/SSHService.py`](AppWeb/BACKEND/app/Services/SSHService.py), construido sobre **paramiko**.

### Credenciales y cifrado en reposo

Para conectarse, cada servicio guarda sus datos de acceso SSH en su propia fila de la tabla `Servicio`: `host` (reutilizado del que ya tenía), `puertoSSH` (22 por defecto), `usuarioSSH`, la **clave privada** y, opcionalmente, su **passphrase**.

La clave privada y la passphrase son secretos: **nunca se guardan en claro**. Se cifran con **Fernet** (cifrado simétrico autenticado, basado en AES) a través del helper [`app/Helpers/Cifrado.py`](AppWeb/BACKEND/app/Helpers/Cifrado.py), que expone `cifrar()` y `descifrar()`. En la base de datos solo vive el texto cifrado (`clavePrivadaCifrada`, `passphraseCifrada`); el texto plano existe únicamente en memoria, durante el instante justo de abrir la conexión.

La clave de cifrado (`ENCRYPTION_KEY`) se configura en el `.env`, **independiente del `SECRET_KEY`** del JWT, y nunca se versiona. Se genera con:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

> ⚠️ **Custodia la `ENCRYPTION_KEY`.** Si se pierde o se cambia, todas las claves ya cifradas dejan de poder descifrarse (`descifrar()` devolverá `None` y el servicio quedará marcado como "credencial no disponible"). Debe respaldarse aparte del repositorio.

Para no exponer nunca el secreto, la respuesta de la API (`ServicioRespuesta`) **no incluye la clave** ni cifrada: solo un booleano calculado `tieneClaveSSH` que le dice al frontend si el servicio ya tiene credenciales configuradas.

### Flujo de un encendido/apagado

```
POST /servicios/{id}/encender
   │
   ├─ 1. Autenticación JWT y filtro por usuario_id   (nadie toca servicios ajenos)
   ├─ 2. Se valida que el servicio tenga comandoArranque
   ├─ 3. SSHService.ejecutar_comando(servicio, comando):
   │        a. descifrar() la clave privada y la passphrase  (en memoria)
   │        b. cargar la clave en paramiko (RSA / Ed25519 / ECDSA)
   │        c. abrir la conexión SSH y ejecutar el comando
   │        d. leer stdout, stderr y el exit_code real
   ├─ 4. Si exit_code == 0  → estado = "activo" y se persiste
   └─ 5. Si falla la máquina → 502 Bad Gateway (el estado no cambia)
```

El servicio SSH **nunca lanza excepciones hacia el controlador**: traduce cualquier fallo (autenticación, host inalcanzable, *timeout*, clave corrupta) a un diccionario estructurado `{ ok, exit_code, stdout, stderr, error }`, y es el controlador quien decide la respuesta HTTP. El **estado del servicio solo se actualiza si el comando terminó con éxito** (`exit_code == 0`); si la máquina remota falla, el estado se mantiene y se devuelve un **`502 Bad Gateway`** (el error es del servidor remoto, no de nuestra API).

| Endpoint | Comando ejecutado | Estado resultante |
|----------|-------------------|-------------------|
| `POST /servicios/{id}/encender` | `comandoArranque` | `activo` (si exit 0) |
| `POST /servicios/{id}/apagar` | `comandoParada` | `inactivo` (si exit 0) |

### Decisiones de seguridad

- **Aislamiento por usuario** — toda consulta filtra por `usuario_id`; un usuario solo puede encender/apagar sus propios servicios.
- **Cifrado en reposo** — las credenciales se guardan cifradas con Fernet; el texto plano solo se descifra en memoria al conectar y nunca se registra en los logs.
- **Autenticación acotada** — paramiko se configura con `allow_agent=False` y `look_for_keys=False`, de modo que la única credencial válida es la clave del servicio (no el agente SSH ni las claves del `~/.ssh` del backend).
- **Auditoría** — cada encendido/apagado correcto se registra con `log_info` (qué usuario, qué acción, qué servicio); los fallos de conexión o autenticación quedan en `log_warning`/`log_error` sin volcar jamás la clave.
- **Timeouts** — 10 s para establecer la conexión y 30 s para la ejecución del comando, para que una máquina caída no deje la petición colgada.
- **Verificación del host *(pendiente de endurecer)*** — actualmente se usa `AutoAddPolicy`, que acepta la huella del servidor sin contrastarla contra un `known_hosts`. Es cómodo para una herramienta propia, pero no detecta un *man-in-the-middle*; queda señalado en el código como punto a reforzar.

---

## 📊 Monitorización de servicios

Cada servicio dispone de un panel de monitorización que muestra, **en vivo**, métricas de la máquina y de la red: **latencia (ms)**, **uso de CPU (%)**, **uso de RAM (%)**, **uso de disco (%)** y **carga del sistema** (load average de 1/5/15 min). La lógica se centraliza en [`app/Services/MonitorService.py`](AppWeb/BACKEND/app/Services/MonitorService.py) y se expone en `GET /servicios/{id}/metricas`.

### Dos fuentes de datos distintas

Las métricas vienen de dos sitios, y conviene distinguirlos:

| Métrica | Origen | Cómo se obtiene |
|---------|--------|-----------------|
| **Latencia** | desde el **backend** | se cronometra (`time.perf_counter`) cuánto tarda el `connect` TCP a `host:puerto`. **No usa SSH.** |
| **CPU, RAM, disco, carga** | **dentro de la máquina** | se leen por **SSH** de `/proc/stat`, `/proc/meminfo`, `df` y `/proc/loadavg`. |

Por eso, aunque el SSH falle (máquina caída, sin credenciales…), la latencia se sigue midiendo y el panel **no se rompe**.

### Una sola conexión SSH por muestra

Abrir una conexión SSH es caro (el *handshake* completo). Para no pagarlo varias veces, **todas** las métricas de la máquina se piden con **un único comando combinado** (una sola conexión), cuya salida se trocea por marcas y se parsea. El **% de CPU** se calcula con **dos lecturas** de `/proc/stat` separadas por `sleep 1`, porque el uso de CPU es una tasa: necesita dos muestras en el tiempo para sacar la diferencia.

### Caché y tolerancia a fallos

- **Caché en Redis (TTL 10 s):** llamadas seguidas (varias pestañas, refrescos) reutilizan la última muestra en vez de reconectar por SSH. El frontend refresca cada 20 s, así que casi siempre encuentra datos frescos.
- **Tolerante a fallos:** cada métrica que no se pueda leer se devuelve como `null` en vez de tumbar la respuesta. El campo `sshOk` indica si las métricas de la máquina se leyeron bien, y `error` lleva el motivo si algo falló. El endpoint responde **`200 OK`** incluso cuando el SSH falla (a diferencia del encender/apagar, que devuelve `502`): monitorizar nunca debe romper la vista.

En el frontend, el panel pinta los porcentajes como **barras de progreso con color por umbral** (verde < 60 %, ámbar < 85 %, rojo ≥ 85 %) y la latencia y la carga como valores destacados.

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
3. **Caché de las métricas de monitorización** — `GET /servicios/{id}/metricas` abre una conexión SSH (cara). El resultado se cachea **10 s** con clave por servicio (`metricas:{servicio_id}`), para que refrescos rápidos o varias pestañas no reconecten una y otra vez.

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
| `GET`  | `/{id}/ping` | Comprobar disponibilidad del servicio (ping TCP) |
| `POST` | `/{id}/encender` | Encender el servicio ejecutando `comandoArranque` por SSH |
| `POST` | `/{id}/apagar` | Apagar el servicio ejecutando `comandoParada` por SSH |
| `GET`  | `/{id}/metricas` | Métricas de monitorización (latencia, CPU, RAM, disco, carga) |
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
| **Servicio** | `id`, `nombre`, `descripcion`, `tipo`, `estado`, `proyectoAsociado`, `host`, `puerto`, `fechaCreacion`, `usuario_id`, + acceso SSH: `puertoSSH`, `usuarioSSH`, `clavePrivadaCifrada`, `passphraseCifrada`, `comandoArranque`, `comandoParada` |
| **Conversacion** | `id`, `titulo`, `fechaCreacion`, `usuario_id`, `proyecto_id` |
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


