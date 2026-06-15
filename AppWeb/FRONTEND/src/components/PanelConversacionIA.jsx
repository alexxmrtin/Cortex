import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '../styles/CentroIA.module.css'; // Reutilizamos los estilos del chat del Centro IA para no duplicar CSS
import apiClient from '../services/api';


// Panel de conversacion con la IA, reutilizable en cualquier parte de la app.
// El modelo que se usa NO se decide aqui: el backend usa el modelo guardado en el usuario (usuario.modeloIA).

// Props (contrato del componente):

//- conversacionId:     id de la conversacion a mostrar. Puede ser null si todavia no exista (por ejemplo, un chat nuevo que aun no ha enviado ningun mensaje).

//-crearConversacion:  funcion async que devuelve el id de una conversacion nueva. La llamamos de forma perezosa al enviar el PRIMER mensaje cuando conversacionId es null.Aqui es donde cada pantalla mete su logica propia (titulo, proyecto_id, etc.).
//Necesitamos esto porque este componente se va a utilizar para diferentes cosas, necesita una funcion del componente padre que cree la conversacion y le pase los datos necesarios a la conversacion como proyectoID o tareasID.

//- onConversacionCreada: (opcional) callback que avisa al padre del id recien creado, por si lo necesita.

//- placeholder:        (opcional) texto del input.

export default function PanelConversacionIA({ conversacionId, crearConversacion, onConversacionCreada, placeholder }) {

  // Guardamos el id en un estado interno propio porque puede cambiar de dos formas:
  //   1. El padre nos pasa un conversacionId distinto (cambio de contexto).
  //   2. Lo creamos nosotros al vuelo en el primer mensaje.
  const [idActual, setIdActual] = useState(conversacionId);

  const [mensajes, setMensajes] = useState([]);    // [{ rol: 'usuario' | 'ia', texto: '...' }] texto que le vamos a pasar al modelo
  const [input, setInput] = useState('');          // texto que escribe el usuario
  const [cargando, setCargando] = useState(false); // true mientras la IA esta respondiendo
  const [error, setError] = useState('');

  // Ancla invisible al final del chat para hacer scroll automatico cuando llega un mensaje nuevo
  const mensajesEndRef = useRef(null);


  // Cuando el padre nos pasa un conversacionId distinto, sincronizamos nuestro id interno
  // y cargamos los mensajes de esa conversacion. Si es null, dejamos el chat en blanco.
  // Todo va dentro de la funcion async para no llamar a setState de forma sincrona en el efecto
  // (eslint lo prohibe porque provoca renders en cascada).
  useEffect(function () {
    let cancelado = false; // bandera para ignorar la respuesta si el efecto se rehace antes de terminar

    async function cargarConversacion() {
      // Sin conversacion (todavia no creada): dejamos el chat en blanco
      if (!conversacionId) {
        setIdActual(null);
        setMensajes([]);
        return;
      }

      try {
        const respuesta = await apiClient.get('/mensajes/conversacion/' + conversacionId);
        if (cancelado) {
          return;
        }
        setIdActual(conversacionId);
        setMensajes(respuesta.data.map(function (m) {
          return { rol: m.rol, texto: m.contenido };
        }));
      } catch (err) {
        console.error('Error al cargar los mensajes', err);
      }
    }

    cargarConversacion();

    // Limpieza: si conversacionId cambia (o se desmonta) antes de terminar, ignoramos la respuesta
    return function () {
      cancelado = true;
    };
  }, [conversacionId]);


  // Cada vez que cambia la lista de mensajes, bajamos el scroll al fondo
  useEffect(function () {
    if (mensajesEndRef.current) {
      mensajesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes]);


  // Envia el mensaje del usuario al backend, que guarda el mensaje, llama a la IA y devuelve su respuesta
  async function enviarMensaje(e) {
    e.preventDefault();

    const texto = input.trim();
    if (!texto || cargando) {
      return;
    }

    // Renderizamos el mensaje del usuario y limpiamos el input
    setMensajes(function (prev) { return [...prev, { rol: 'usuario', texto: texto }]; });
    setInput('');
    setCargando(true);

    // Guardamos el id en una variable local porque puede que aun no exista la conversacion
    let id = idActual;

    let recienCreada = false; // marca si hemos creado la conversacion en este envio

    try {
      // Si todavia no hay conversacion, le pedimos al padre que la cree (logica propia de cada pantalla)
      if (!id) {
        if (!crearConversacion) {
          throw new Error('No hay conversacion ni forma de crearla');
        }
        id = await crearConversacion(); //Funcion que le pasa el padre creando la conversacion
        setIdActual(id);
        recienCreada = true;
      }

      // Llamamos al endpoint de chat: guarda el mensaje, llama a la IA y devuelve la respuesta
      const respuesta = await apiClient.post('/mensajes/conversacion/' + id + '/chat', { contenido: texto });
      setMensajes(function (prev) { return [...prev, { rol: 'ia', texto: respuesta.data.contenido }]; });

      // Avisamos al padre del id SOLO ahora que el servidor ya tiene los mensajes guardados.
      // (Si lo hicieramos antes, el efecto recargaria una conversacion vacia y borraria el mensaje optimista.)
      if (recienCreada && onConversacionCreada) {
        onConversacionCreada(id);
      }
    }

    catch (err) {
      if (err.response && err.response.status === 500) {
        setError(`${err.response.data.detail.split(' ').slice(0, 5).join(' ')}. El modelo no esta disponible en este momento`);
      }
      else if (err.response && err.response.status === 429) {
        setError(err.response.data.detail); // El usuario ha superado las 30 peticiones diarias
      }
      else {
        setError('No se pudo conectar con el servidor.');
      }
    }

    finally {
      setCargando(false);
    }
  }



  // Preparamos la lista de mensajes a renderizar. Segun el rol aplicamos un estilo u otro.
  const itemsMensajes = mensajes.map(function (m, i) {

    // Clase del contenedor segun quien habla
    let claseContenedor = styles.mensajeIA;
    if (m.rol === 'usuario') {
      claseContenedor = styles.mensajeUsuario;
    }

    // Avatar: solo lo mostramos en los mensajes de la IA
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

    // Contenido de la burbuja: la IA puede responder en Markdown, el usuario es texto plano
    let contenidoBurbuja = m.texto;
    if (m.rol === 'ia') {
      contenidoBurbuja = <ReactMarkdown>{m.texto}</ReactMarkdown>;
    }

    return (
      <div key={i} className={claseContenedor}>
        {avatarIA}
        <div className={styles.mensajeBurbuja}>
          {contenidoBurbuja}
        </div>
      </div>
    );
  });


  // Animacion de "escribiendo..." mientras esperamos la respuesta de la IA
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


  // Si el padre no nos pasa placeholder, usamos uno generico
  let textoPlaceholder = placeholder;
  if (!textoPlaceholder) {
    textoPlaceholder = 'Escribe tu mensaje...';
  }


  // Renderizado
  return (
    <div className={styles.chat}>
      <div className={styles.mensajes}>
        {itemsMensajes}
        {animacionCargando}
        <div ref={mensajesEndRef}/>
      </div>

      {error && <p className={styles.errorMensaje}>{error}</p>}

      <form className={styles.inputArea} onSubmit={enviarMensaje}>
        <input
          className={styles.input}
          type="text"
          placeholder={textoPlaceholder}
          value={input}
          onChange={function (e) {
            setInput(e.target.value);
            setError('');
          }}
          disabled={cargando}
        />
        <button className={styles.enviarBtn} type="submit" disabled={!input.trim() || cargando}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
