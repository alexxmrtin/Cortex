import { useState } from 'react';
import styles from '../styles/Ajustes.module.css';
import perfilNoDefinido from '../assets/perfilNoDefinido.jpg';

const SECCIONES = ['Perfil', 'Seguridad', 'Apariencia', 'Cuenta'];

function SeccionPerfil() {
  const [nombre, setNombre] = useState('Usuario');
  const [email, setEmail] = useState('usuario@cortex.com');

  return (
    <div className={styles.seccion}>
      <h2 className={styles.seccionTitulo}>Perfil</h2>
      <p className={styles.seccionDesc}>Información visible de tu cuenta.</p>

      <div className={styles.avatarFila}>
        <img src={perfilNoDefinido} alt="Avatar" className={styles.avatar} />
        <div className={styles.avatarInfo}>
          <button className={styles.botonSecundario}>Cambiar foto</button>
          <span className={styles.avatarHint}>JPG o PNG, máx. 2MB</span>
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

      <button className={styles.botonPrimario}>Guardar cambios</button>
    </div>
  );
}

function SeccionSeguridad() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');

  return (
    <div className={styles.seccion}>
      <h2 className={styles.seccionTitulo}>Seguridad</h2>
      <p className={styles.seccionDesc}>Gestiona tu contraseña y sesiones activas.</p>

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
        <button className={styles.botonPrimario}>Actualizar contraseña</button>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitulo}>Sesiones</h3>
        <p className={styles.cardDesc}>Cierra tu sesión en todos los dispositivos donde hayas iniciado sesión.</p>
        <button className={styles.botonSecundario}>Cerrar todas las sesiones</button>
      </div>
    </div>
  );
}

function SeccionApariencia() {
  const [tema, setTema] = useState('claro');

  return (
    <div className={styles.seccion}>
      <h2 className={styles.seccionTitulo}>Apariencia</h2>
      <p className={styles.seccionDesc}>Personaliza el aspecto visual de Cortex.</p>

      <div className={styles.card}>
        <h3 className={styles.cardTitulo}>Tema</h3>
        <div className={styles.temaOpciones}>
          <button
            className={tema === 'claro' ? styles.temaBotonActivo : styles.temaBoton}
            onClick={function() { setTema('claro'); }}
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
            className={tema === 'oscuro' ? styles.temaBotonActivo : styles.temaBoton}
            onClick={function() { setTema('oscuro'); }}
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

function SeccionCuenta() {
  const [confirmar, setConfirmar] = useState(false);

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
              <button className={styles.botonPeligro}>Confirmar eliminación</button>
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

export default function Ajustes() {
  const [seccionActiva, setSeccionActiva] = useState('Perfil');

  const contenido = {
    'Perfil':     <SeccionPerfil />,
    'Seguridad':  <SeccionSeguridad />,
    'Apariencia': <SeccionApariencia />,
    'Cuenta':     <SeccionCuenta />,
  };

  return (
    <div className={styles.page}>
      <aside className={styles.nav}>
        <p className={styles.navTitulo}>Ajustes</p>
        {SECCIONES.map(function(s) {
          return (
            <button
              key={s}
              className={seccionActiva === s ? styles.navItemActivo : styles.navItem}
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
