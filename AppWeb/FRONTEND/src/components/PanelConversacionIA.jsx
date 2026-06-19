import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '../styles/CentroIA.module.css'; // Reutilizamos los estilos del chat del Centro IA para no duplicar CSS
import apiClient from '../services/api';


// Panel de conversacion con la IA, reutilizable en cualquier parte de la app.
// El modelo que se usa NO se decide aqui: el backend usa el modelo guardado en el usuario (usuario.modeloIA).

// Props (contrato del componente):

//- conversacionesIds:  array con las ids de las conversaciones asociadas al contexto (p. ej. un proyecto). Puede venir vacio ([]) si todavia no existe ninguna.

//-crearConversacion:  funcion async que devuelve el id de una conversacion nueva. La llamamos de forma perezosa al enviar el PRIMER mensaje cuando no hay ninguna conversacion seleccionada.Aqui es donde cada pantalla mete su logica propia (titulo, proyecto_id, etc.).
//Necesitamos esto porque este componente se va a utilizar para diferentes cosas, necesita una funcion del componente padre que cree la conversacion y le pase los datos necesarios a la conversacion como proyectoID o tareasID.

//- onConversacionCreada: (opcional) callback que avisa al padre del id recien creado, por si lo necesita.

//- placeholder:        (opcional) texto del input.

export default function PanelConversacionIA({ conversacionesIds, crearConversacion, onConversacionCreada, placeholder }) {

  // Conversacion que el usuario ha elegido en el selector. null = no ha elegido, usamos la primera por defecto.
  const [seleccionUsuario, setSeleccionUsuario] = useState(null);

  // Controla si el desplegable con la lista de conversaciones esta abierto.
  const [mostrarPanel, setMostrarPanel] = useState(false);

  // Conversacion que se muestra ahora mismo: la que el usuario eligio, o la primera de la lista si no eligio ninguna.Lo calculamos en cada render (no es estado) para no tener que sincronizar con un efecto.
  let conversacionSeleccionada = seleccionUsuario;
  if (conversacionSeleccionada === null && conversacionesIds.length > 0) {
    conversacionSeleccionada = conversacionesIds[0];
  }

  // Guardamos el id en un estado interno propio porque puede cambiar de dos formas:
  //   1. Cambia la conversacion seleccionada (el padre o el usuario eligen otra).
  //   2. La creamos nosotros al vuelo en el primer mensaje.
  const [idActual, setIdActual] = useState(null);

  const [mensajes, setMensajes] = useState([]);    // [{ rol: 'usuario' | 'ia', texto: '...' }] texto que le vamos a pasar al modelo
  const [input, setInput] = useState('');          // texto que escribe el usuario
  const [cargando, setCargando] = useState(false); // true mientras la IA esta respondiendo
  const [error, setError] = useState('');

  // Ancla invisible al final del chat para hacer scroll automatico cuando llega un mensaje nuevo
  const mensajesEndRef = useRef(null);


  // Cuando cambia la conversacion seleccionada (el padre nos pasa otra lista, o llega la lista por primera vez),sincronizamos nuestro id interno y cargamos sus mensajes. Si no hay ninguna, dejamos el chat en blanco.Todo va dentro de la funcion async para no llamar a setState de forma sincrona en el efecto(eslint lo prohibe porque provoca renders en cascada).
  useEffect(function () {
    let cancelado = false; // bandera para ignorar la respuesta si el efecto se rehace antes de terminar

    async function cargarConversacion() {
      // Sin conversacion (todavia no creada): dejamos el chat en blanco
      if (!conversacionSeleccionada) {
        setIdActual(null);
        setMensajes([]);
        return;
      }

      try {
        const respuesta = await apiClient.get('/mensajes/conversacion/' + conversacionSeleccionada);
        if (cancelado) {
          return;
        }
        setIdActual(conversacionSeleccionada);
        setMensajes(respuesta.data.map(function (m) {
          return { rol: m.rol, texto: m.contenido };
        }));
      } catch (err) {
        console.error('Error al cargar los mensajes', err);
      }
    }

    cargarConversacion();

    // Limpieza: si la conversacion seleccionada cambia (o se desmonta) antes de terminar, ignoramos la respuesta
    return function () {
      cancelado = true;
    };
  }, [conversacionSeleccionada]);


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

      // Avisamos al padre del id SOLO ahora que el servidor ya tiene los mensajes guardados.(Si lo hicieramos antes, el efecto recargaria una conversacion vacia y borraria el mensaje optimista.)
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



  // Abre o cierra el desplegable de conversaciones
  function alternarPanel() {
    if (mostrarPanel) {
      setMostrarPanel(false);
    } else {
      setMostrarPanel(true);
    }
  }

  // El usuario elige una conversacion del desplegable: la guardamos como su seleccion (el efecto de carga la renderiza) y cerramos el panel
  function seleccionarConversacion(idConversacion) {
    setSeleccionUsuario(idConversacion);
    setMostrarPanel(false);
    setError('');
  }


  // Preparamos la lista de conversaciones del desplegable. Como por ahora solo tenemos sus ids, las etiquetamos por posicion ("Conversacion 1", "Conversacion 2"...). La activa se resalta.
  let itemsConversaciones;
  if (conversacionesIds.length > 0) {
    itemsConversaciones = conversacionesIds.map(function (idConversacion, i) {
      let claseItem = styles.itemConversacion;
      if (idConversacion === conversacionSeleccionada) {
        claseItem = claseItem + ' ' + styles.itemConversacionActivo;
      }
      return (
        <button
          key={idConversacion}
          type="button"
          className={claseItem}
          onClick={function () { seleccionarConversacion(idConversacion); }}
        >
          Conversación {i + 1}
        </button>
      );
    });
  } else {
    itemsConversaciones = <p className={styles.listaVacia}>No hay conversaciones todavía</p>;
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

      {/* Selector de conversaciones: boton encima del formulario que despliega la lista hacia arriba */}
      <div className={styles.selectorConversaciones}>
        {mostrarPanel && (
          <div className={styles.listaConversaciones}>
            {itemsConversaciones}
          </div>
        )}
        <button type="button" className={styles.toggleConversaciones} onClick={alternarPanel}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Conversaciones ({conversacionesIds.length})
        </button>
      </div>

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
