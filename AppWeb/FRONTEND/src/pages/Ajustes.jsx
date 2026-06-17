import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from '../styles/Ajustes.module.css';
import perfilNoDefinido from '../assets/perfilNoDefinido.jpg';
import apiClient, { API_BASE_URL } from '../services/api';

const SECCIONES = ['Perfil', 'Seguridad', 'Apariencia', 'Cuenta'];


//SECCION PERFIL
function SeccionPerfil({ usuario }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  
  const [fotoPerfil, setFotoPerfil] = useState(perfilNoDefinido);
  const [archivoFoto, setArchivoFoto] = useState(null);
  const [errorFoto, setErrorFoto] = useState('');
  const [error, setError] = useState('');
  const inputFoto = useRef(null);

  useEffect(function() {
    if (usuario) {
      setNombre(usuario.nombreUsuario);
      setEmail(usuario.email);
      if (usuario.fotoPerfil) {
        setFotoPerfil(`${API_BASE_URL}${usuario.fotoPerfil}`);
      }
    }
  }, [usuario]);


  //e es el evento que pasa cuando se ejecuta el evento onChange
  async function handleCambiarFoto(e) {
    const archivo = e.target.files[0]; //Variable que guarda los archivos seleccionados, guartda solo el primer archivo
    if (!archivo) return;

    //Validamos que el archivo sea de menos de 2mb
    if (archivo.size > 2 * 1024 * 1024) {
      setErrorFoto('La imagen no puede superar 2MB');
      return;
    }
    setErrorFoto(''); //Necesario reiterar aqui para que no salte el error si el usuario elige otra imagen

    setArchivoFoto(archivo);
    setFotoPerfil(URL.createObjectURL(archivo)); //Genera una URL temporal local (blob:) que apunta al archivo en memoria, sin subirlo al servidor
  }

  //Cuando el usuario confirma, ya subimos la imagen y demas al servidor
  async function handleSubmit() {
    try {
      if (archivoFoto) {
        const formData = new FormData();
        formData.append('archivo', archivoFoto);

        await apiClient.post('/usuarios/me/foto', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      await apiClient.patch('/usuarios/me', { nombreUsuario: nombre, email: email });
      setError('');
    } catch (error) {
      setError(error.response?.data?.detail || 'Error al guardar los cambios');
    }
  }


  //Hay un input oculto al que apunta la ref inputFoto, cuando es input recibe un archivo del usuario, se ejecuta la funcion handleCambiarFoto
  return (
    <div className={styles.seccion}>
      <h2 className={styles.seccionTitulo}>Perfil</h2>
      <p className={styles.seccionDesc}>Información visible de tu cuenta.</p>

      <div className={styles.avatarFila}>
        <img src={fotoPerfil} alt="Avatar" className={styles.avatar} />
        <div className={styles.avatarInfo}>
          <input
            ref={inputFoto}
            type="file"
            accept="image/jpeg,image/png"
            style={{ display: 'none' }}
            onChange={handleCambiarFoto}
          />
          <button className={styles.botonSecundario} onClick={function() { inputFoto.current.click(); }}>
            Cambiar foto
          </button>
          <span className={styles.avatarHint}>JPG o PNG, máx. 2MB</span>
          {errorFoto && <span className={styles.errorTexto}>{errorFoto}</span>}
        </div>
      </div>

      <div className={styles.campo}>
        <label className={styles.label}>Nombre de usuario</label>
        <input
          className={styles.input}
          type="text"
          value={nombre}
          onChange={function(e) { setNombre(e.target.value); }}
        />
      </div>

      <div className={styles.campo}>
        <label className={styles.label}>Email</label>
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={function(e) { setEmail(e.target.value); }}
        />
      </div>

      {error && <span className={styles.errorTexto}>{error}</span>}
      <button onClick={handleSubmit} className={styles.botonPrimario}>Guardar cambios</button>
    </div>
  );
}


//SECCION SEGURIDAD
function SeccionSeguridad() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(){
    if (nueva !== confirmar){
      setError('Las contraseñas deben ser iguales');
      return;
    }
    setError('');
    
    try {
      await apiClient.patch('/usuarios/me/contrasena', { contrasenaActual: actual, contrasenaNueva: nueva });
    } catch (error) {
      setError(error.response.data.detail);
    }
  }

  return (
    <div className={styles.seccion}>
      <h2 className={styles.seccionTitulo}>Seguridad</h2>
      <p className={styles.seccionDesc}>Gestiona tu contraseña.</p>

      <div className={styles.card}>
        <h3 className={styles.cardTitulo}>Cambiar contraseña</h3>
        <div className={styles.campo}>
          <label className={styles.label}>Contraseña actual</label>
          <input
            className={styles.input}
            type="password"
            value={actual}
            onChange={function(e) { setActual(e.target.value); }}
          />
        </div>
        <hr className={styles.separador} />
        <div className={styles.campo}>
          <label className={styles.label}>Nueva contraseña</label>
          <input
            className={styles.input}
            type="password"
            value={nueva}
            onChange={function(e) { setNueva(e.target.value); }}
          />
        </div>
        <div className={styles.campo}>
          <label className={styles.label}>Confirmar nueva contraseña</label>
          <input
            className={styles.input}
            type="password"
            value={confirmar}
            onChange={function(e) { setConfirmar(e.target.value); }}
          />
        </div>
        {error && <span className={styles.errorTexto}>{error}</span>}
        <button onClick={handleSubmit} className={styles.botonPrimario}>Actualizar contraseña</button>
      </div>
    </div>
  );
}


//SECCION APARIENCIA
function SeccionApariencia() {
  // El tema activo se lee de localStorage (la fuente de verdad para aplicarlo en toda la app)
  const [tema, setTema] = useState(function () {
    if (localStorage.getItem('tema') === 'oscuro') {
      return 'oscuro';
    }
    return 'claro';
  });

  async function handleTema(nuevoTema){
    setTema(nuevoTema);

    // 1. Aplicamos el tema al instante poniendo/quitando data-theme="dark" en <html>
    if (nuevoTema === 'oscuro') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // 2. Lo guardamos en localStorage para que persista y se aplique al recargar (lo lee main.jsx)
    localStorage.setItem('tema', nuevoTema);

    // 3. Lo guardamos tambien en el backend como preferencia del usuario
    try {
      await apiClient.patch('/usuarios/me', { tema: nuevoTema });
    } catch (err) {
      console.error('Error al guardar el tema', err);
    }
  }

  // Clase de cada boton segun el tema activo (sin ternario)
  let claseClaro = styles.temaBoton;
  if (tema === 'claro') {
    claseClaro = styles.temaBotonActivo;
  }
  let claseOscuro = styles.temaBoton;
  if (tema === 'oscuro') {
    claseOscuro = styles.temaBotonActivo;
  }


  return (
    <div className={styles.seccion}>
      <h2 className={styles.seccionTitulo}>Apariencia</h2>
      <p className={styles.seccionDesc}>Personaliza el aspecto visual de Cortex.</p>

      <div className={styles.card}>
        <h3 className={styles.cardTitulo}>Tema</h3>
        <div className={styles.temaOpciones}>
          <button
            className={claseClaro}
            onClick={function() { handleTema('claro'); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            Claro
          </button>
          <button
            className={claseOscuro}
            onClick={function() { handleTema('oscuro'); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            Oscuro
          </button>
        </div>
      </div>
    </div>
  );
}


//SECCION CUENTA
function SeccionCuenta() {
  const [confirmar, setConfirmar] = useState(false);
  const navigate = useNavigate();

  async function handleEliminarCuenta() {
    try {
      await apiClient.delete('/usuarios/me');
      localStorage.removeItem('authToken');
      navigate('/');
    } catch (err) {
      console.error('Error al eliminar la cuenta', err);
    }
  }

  //Seteamos el estado confirmar a false, cuando se renderiza esta en false por tanto se renderiza la primera parte del if (es un if comprimido), si clickamos hacemos que el estado confirmar sea true, por lo que al renderizar de nuevo, se va al else y renderiza un html distinto,si pulsamos confirmar ya es cuando llamamos a la API
  return (
    <div className={styles.seccion}>
      <h2 className={styles.seccionTitulo}>Cuenta</h2>
      <p className={styles.seccionDesc}>Acciones permanentes sobre tu cuenta.</p>

      <div className={styles.cardPeligro}>
        <h3 className={styles.cardTituloPeligro}>Eliminar cuenta</h3>
        <p className={styles.cardDesc}>
          Esta acción es irreversible. Se eliminarán permanentemente todos tus proyectos, servicios y datos asociados.
        </p>
        {!confirmar ? (
          <button className={styles.botonPeligro} onClick={function() { setConfirmar(true); }}>
            Eliminar mi cuenta
          </button>
        ) : (
          <div className={styles.confirmacion}>
            <p className={styles.confirmacionTexto}>¿Estás seguro? Esta acción no se puede deshacer.</p>
            <div className={styles.confirmacionBotones}>
              <button className={styles.botonPeligro} onClick={handleEliminarCuenta}>
                Confirmar eliminación
              </button>
              <button className={styles.botonSecundario} onClick={function() { setConfirmar(false); }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

//FUNCION PRINCIPAL
export default function Ajustes() {
  const [seccionActiva, setSeccionActiva] = useState('Perfil');

  const token = localStorage.getItem('authToken');
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);

  useEffect(function() {
    if (!token) return;
    
    async function cargarUsuario() {
      try {
        const respuesta = await apiClient.get('/usuarios/me');
        setUsuario(respuesta.data);
      } catch (err) {
        console.error('Error al cargar el usuario', err);
      }
    }
    cargarUsuario();
  }, []);


  //usuario no esta contenida fuera de Ajustes() por lo que se lo tenemos que pasar a todos los componentes para que puedan usarlo
  const contenido = {
    'Perfil':     <SeccionPerfil usuario={usuario} />,
    'Seguridad':  <SeccionSeguridad />,
    'Apariencia': <SeccionApariencia />,
    'Cuenta':     <SeccionCuenta usuario={usuario} />,
  };

  //Esto es hace para que no puedas entrar a la url sin token, el usuario puede poner /ajustes y entrar aunque no este logeado
  if (!token) {
    navigate('/');
    return null;
  }
  if (token){
    return (
    <div className={styles.page}>
      <aside className={styles.nav}>
        <p className={styles.navTitulo}>Ajustes</p>
        {SECCIONES.map(function(s) {
          let claseBoton;
          
          if (seccionActiva === s) {
            claseBoton = styles.navItemActivo;
          } 
          else {
            claseBoton = styles.navItem;
          }
          return (
            <button
              key={s}
              className={claseBoton}
              onClick={function() { setSeccionActiva(s); }}
            >
              {s}
            </button>
          );
        })}
      </aside>

      <main className={styles.contenido}>
        {contenido[seccionActiva]}
      </main>
    </div>
  );
  }
}
