import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/CentroIA.module.css';
import perfilNoDefinido from '../assets/perfilNoDefinido.jpg';

//Estas conversaciones deben ser dinamicas
const CONVERSACIONES_PRUEBA = [
  { id: 1, titulo: 'Desactivame un servicio', fecha: 'Hoy' },
  { id: 2, titulo: 'Resumeme un proyecto', fecha: 'Ayer' },
  { id: 3, titulo: 'Generame un README para un proyecto', fecha: '3 jun' },
];

export default function CentroIA() {
  const [conversaciones] = useState(CONVERSACIONES_PRUEBA);
  const [conversacionActiva, setConversacionActiva] = useState(null); //Guarda que conversaciones estas abiertas
  const [mensajes, setMensajes] = useState([]); //Guarda historial dentro de un chat
  const [input, setInput] = useState(''); //Texto que escribe el usuario
  const [cargando, setCargando] = useState(false); //Indicador si la IA esta respondiendo, si esta en true, aparece una animacion
  const mensajesEndRef = useRef(null); //Creamos una referencia a null


  //Funcion useEffect() que se ejecuta cada vez que cambia el array mensajes[], sirve para hacer un scroll de el chat
  useEffect(function () {
    if (mensajesEndRef.current) {
      mensajesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes]);


  //Funcion que se llama cuando abrimos un nuevo chat, limpia todos los estados
  function nuevaConversacion() {
    setConversacionActiva(null);
    setMensajes([]);
  }


  //Funcion que se llama cuando abrimos un chat existente
  function abrirConversacion(conv) {
    setConversacionActiva(conv.id);

    //Modificar
    setMensajes([
      { rol: 'ia', texto: 'Hola, ¿en qué puedo ayudarte con ' + conv.titulo + '?' },
    ]);
  }


  //Esta es la funcion mas importante de esta pagina,se ejecuta al enviar un mensaje en el chat
  function enviarMensaje(e) {
    e.preventDefault(); //Como es un formulario el chat, esto impide que se recarge cuando le das al boton de submitt
    const texto = input.trim(); //Limpia espacios, si escribimos "    hola", queda "hola"
    if (!texto || cargando) return; //Impide mensajes vacios o cuando responde la IA

    //Añade el mensaje del usuario al array mensajes[] con una estructura en forma json
    setMensajes(function (prev) {
      return [...prev, { rol: 'usuario', texto: texto }];
    });
    setInput('');
    setCargando(true);

    //Esta funcion es una simulacion de una respuesta de la IA, reemplazar con llamada real al backend de IA
    setTimeout(function () {
      setMensajes(function (prev) {
        return [...prev, { rol: 'ia', texto: 'Esta es una respuesta de prueba. El backend de IA aún no está conectado.' }];
      });
      setCargando(false);
    }, 1200);
  }


  //Recorre todas las conversaciones y genera un html con las conversaciones listo para ponerlo en la sidebar, mirar mejor cuando queramos hacerlo dinamico
  //.map() recorre el array conversaciones[] y le aplica la funcion a cada elemento
  const itemsConversaciones = conversaciones.map(function (conv) {
    let itemClass = styles.sidebarItem;

    //Si la conversacion esta abierta, modificamos el estilo
    if (conv.id === conversacionActiva) {
      itemClass = itemClass + ' ' + styles.sidebarItemActive;
    }

    return (
      <button key={conv.id} className={itemClass} onClick={function () { abrirConversacion(conv); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span className={styles.sidebarItemText}>
          <span>{conv.titulo}</span>
          <span className={styles.sidebarItemFecha}>{conv.fecha}</span>
        </span>
      </button>
    );
  });


  // Construye la lista de burbujas de mensajes, .map() recorre todo el array mensajes[] y le aplica una funcion. "m" es el contenido de una iteracion sobre el array y "i" es un contador para saber en que iteracion estamos
  const itemsMensajes = mensajes.map(function (m, i) {
    let claseContenedor;
    
    //Dependiendo si la interacion de .map es un mensaje de usuario o de la IA, establce un estilo y lo lalmacena en la variable claseCOntenedor
    if (m.rol === 'usuario') {
      claseContenedor = styles.mensajeUsuario;
    } else {
      claseContenedor = styles.mensajeIA;
    }

    //Si m.rol es la ia, crearemos un div con la imagen de la ia y la guardaremos en avatarIA
    let avatarIA = null;
    if (m.rol === 'ia') {
      avatarIA = (
        <div className={styles.iaAvatar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>
          </svg>
        </div>
      );
    }

    //Y ya por ultimo esta funcion vba a devolver un html que contiene el mensaje en si, ya sea de usuario o de la IA
    return (
      <div key={i} className={claseContenedor}>
        {avatarIA}
        <div className={styles.mensajeBurbuja}>{m.texto}</div>
      </div>
    );
  });


  // Animación de puntos mientras la IA está respondiendo
  let animacionCargando = null;
  if (cargando) {
    animacionCargando = (
      <div className={styles.mensajeIA}>
        <div className={styles.iaAvatar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>
          </svg>
        </div>
        <div className={styles.mensajeBurbuja + ' ' + styles.cargando}>
          <span/><span/><span/>
        </div>
      </div>
    );
  }


  // Dependiendo de si hay mensajes en el chat o no, mostrara una cosa u otra, si no tiene mensajes, mostrara una interfaz con sugerencias
  let contenidoPrincipal;
  if (mensajes.length === 0) {
    contenidoPrincipal = (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="10" rx="2"/>
            <path d="M12 11V7"/>
            <circle cx="12" cy="5" r="2"/>
            <path d="M8 11V9a4 4 0 0 1 8 0v2"/>
            <line x1="8" y1="15" x2="8" y2="15" strokeWidth="3" strokeLinecap="round"/>
            <line x1="12" y1="15" x2="12" y2="15" strokeWidth="3" strokeLinecap="round"/>
            <line x1="16" y1="15" x2="16" y2="15" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className={styles.emptyTitle}>Centro de IA</h2>
        <p className={styles.emptySubtitle}>Inicia una nueva conversación o selecciona una del historial</p>
        <div className={styles.sugerencias}>
          {['Desactiva un servicio', 'Resume un proyecto', 'Crea un README de un proyecto'].map(function (s) {
            return (
              <button key={s} className={styles.sugerencia} onClick={function () { setInput(s); }}>
                {s}
              </button>
            );
          })}
        </div>
      </div>
    );
  } else {
    contenidoPrincipal = (
      <div className={styles.chat}>
        <div className={styles.mensajes}>
          {itemsMensajes}
          {animacionCargando}
          <div ref={mensajesEndRef}/>
        </div>
      </div>
    );
  }

  // Desactiva el botón de enviar si el input está vacío o la IA está respondiendo
  let enviarDesactivado;
  if (!input.trim() || cargando) {
    enviarDesactivado = true;
  } else {
    enviarDesactivado = false;
  }

  //Por ultimo esto ya es el html renderizado
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>

        <button className={styles.sidebarItem} onClick={nuevaConversacion}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva conversación
        </button>

        <Link to="/proyectos" className={styles.sidebarItem}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Ir a Proyectos
        </Link>

        <nav className={styles.sidebarNav}>
          <p className={styles.sidebarSection}>Conversaciones</p>
          {itemsConversaciones}
        </nav>

        <Link to="/ajustes" className={styles.sidebarUser}>
          <img src={perfilNoDefinido} alt="perfil" className={styles.sidebarAvatar} />
          <div className={styles.sidebarUserInfo}>
            <span className={styles.sidebarUserName}>Usuario</span>
            <span className={styles.sidebarUserRole}>Miembro</span>
          </div>
        </Link>
      </aside>

      <main className={styles.content}>
        {contenidoPrincipal}

        <form className={styles.inputArea} onSubmit={enviarMensaje}>
          <input
            className={styles.input}
            type="text"
            placeholder="Escribe tu mensaje..."
            value={input}
            onChange={function (e) { setInput(e.target.value); }}
            disabled={cargando}
          />
          <button className={styles.enviarBtn} type="submit" disabled={enviarDesactivado}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </main>
    </div>
  );
}
