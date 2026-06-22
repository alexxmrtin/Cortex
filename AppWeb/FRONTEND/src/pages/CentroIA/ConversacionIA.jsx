import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import styles from '../../styles/CentroIA.module.css';
import apiClient, { API_BASE_URL, obtenerToken } from '../../services/api';

export default function ConversacionIA() {
  const { id } = useParams(); //Id de la conversacion activa, leido de la URL /centroIA/conversacion/:id

  const [mensajes, setMensajes] = useState([]); //Array de mensajes { rol: 'usuario'|'ia', texto: '...', fuentes: [...] }
  const [input, setInput] = useState(''); //texto que escribe el usuario
  const [cargando, setCargando] = useState(false); //true mientras la IA esta respondiendo
  const [error, setError] = useState('');
  const [archivoModal, setArchivoModal] = useState(null); //archivo abierto en el modal de citaciones, o null

  // useRef para hacer scroll automático al fondo del chat cuando llega un mensaje nuevo
  const mensajesEndRef = useRef(null);


  // Carga los mensajes de esta conversación desde la API al entrar, y cada vez que cambia el id
  useEffect(function () {

    async function cargarMensajes() {
      try {
        const respuesta = await apiClient.get('/mensajes/conversacion/' + id);
        // La API devuelve { id, contenido, rol, fecha, fuentes }. El historial guardado no trae fuentes (son
        // efimeras de cada respuesta), asi que las citaciones solo aparecen en los mensajes de esta sesion.
        setMensajes(respuesta.data.map(function (m) {
          return { rol: m.rol, texto: m.contenido, fuentes: m.fuentes || [] };
        }));
      } catch (err) {
        console.error('Error al cargar los mensajes', err);
      }
    }

    cargarMensajes();

  }, [id]);


  // Scroll automático al fondo cada vez que cambian los mensajes (incluido cada token del streaming)
  useEffect(function () {
    if (mensajesEndRef.current) {
      mensajesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes]);


  // Traduce un error HTTP (antes de empezar el stream) a un mensaje para el usuario
  function manejarErrorHttp(status, detalle) {
    if (status === 429) {
      setError(detalle); //El usuario ha superado el limite diario
    } else if (status === 500) {
      setError('El modelo no está disponible en este momento.');
    } else {
      setError('No se pudo conectar con el servidor.');
    }
  }


  async function enviarMensaje(e) {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || cargando) return;

    setMensajes(function (prev) { return [...prev, { rol: 'usuario', texto, fuentes: [] }]; });
    setInput('');
    setError('');
    setCargando(true);

    // iaCreada controla si ya hemos añadido la burbuja de la IA: el primer token la crea, el resto la rellenan
    let iaCreada = false;

    try {
      // Usamos fetch (no axios) porque necesitamos leer la respuesta en streaming (SSE) trozo a trozo
      const respuesta = await fetch(API_BASE_URL + '/mensajes/conversacion/' + id + '/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + obtenerToken()
        },
        body: JSON.stringify({ contenido: texto })
      });

      // Si falla ANTES de empezar el stream (404/429/500), el cuerpo es un JSON normal con el detalle
      if (!respuesta.ok) {
        let detalle = '';
        try {
          const json = await respuesta.json();
          detalle = json.detail;
        } catch {
          detalle = '';
        }
        manejarErrorHttp(respuesta.status, detalle);
        setCargando(false);
        return;
      }

      // Leemos el stream: el cuerpo llega en trozos de bytes que vamos decodificando y partiendo por eventos SSE
      const lector = respuesta.body.getReader();
      const decodificador = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await lector.read();
        if (done) break;

        buffer += decodificador.decode(value, { stream: true });

        // Los eventos SSE van separados por "\n\n". El ultimo trozo puede estar incompleto: lo dejamos en el buffer.
        const partes = buffer.split('\n\n');
        buffer = partes.pop();

        for (const parte of partes) {
          const linea = parte.trim();
          if (!linea.startsWith('data:')) continue;

          const evento = JSON.parse(linea.slice(5).trim());

          if (evento.tipo === 'token') {
            if (!iaCreada) {
              iaCreada = true;
              setMensajes(function (prev) { return [...prev, { rol: 'ia', texto: evento.contenido, fuentes: [] }]; });
            } else {
              setMensajes(function (prev) {
                const copia = [...prev];
                const ultimo = copia[copia.length - 1];
                copia[copia.length - 1] = { ...ultimo, texto: ultimo.texto + evento.contenido };
                return copia;
              });
            }
          }

          else if (evento.tipo === 'fin') {
            // Si no llego ningun token (respuesta vacia), creamos igualmente la burbuja
            if (!iaCreada) {
              iaCreada = true;
              setMensajes(function (prev) { return [...prev, { rol: 'ia', texto: '', fuentes: evento.fuentes || [] }]; });
            } else {
              setMensajes(function (prev) {
                const copia = [...prev];
                const ultimo = copia[copia.length - 1];
                copia[copia.length - 1] = { ...ultimo, fuentes: evento.fuentes || [] };
                return copia;
              });
            }
          }

          else if (evento.tipo === 'error') {
            setError('El modelo no está disponible en este momento.');
          }
        }
      }
    }

    catch {
      setError('No se pudo conectar con el servidor.');
    }

    finally {
      setCargando(false);
    }
  }


  // Abre el contenido de un archivo (citacion) en el modal, reutilizando el endpoint de previsualizacion
  async function abrirArchivo(archivoId) {
    try {
      const respuesta = await apiClient.get('/archivos/' + archivoId + '/contenido');
      setArchivoModal(respuesta.data);
    } catch (err) {
      console.error('No se pudo abrir el archivo', err);
      setError('No se pudo abrir el archivo de la cita.');
    }
  }


  //Preparamos lo que se va a enseñar en la conversacion
  const itemsMensajes = mensajes.map(function (m, i) {
    const claseContenedor = m.rol === 'usuario' ? styles.mensajeUsuario : styles.mensajeIA;

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

    // Mensaje del usuario: burbuja simple, sin citaciones
    if (m.rol === 'usuario') {
      return (
        <div key={i} className={claseContenedor}>
          <div className={styles.mensajeBurbuja}>{m.texto}</div>
        </div>
      );
    }

    // Mensaje de la IA: burbuja con markdown + (opcional) citaciones debajo
    let citaciones = null;
    if (m.fuentes && m.fuentes.length > 0) {
      citaciones = (
        <div className={styles.fuentes}>
          {m.fuentes.map(function (f, j) {
            return (
              <button key={j} className={styles.fuenteChip} onClick={function () { abrirArchivo(f.archivo_id); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                {f.rutaRelativa} (L{f.linea_inicio}-{f.linea_fin})
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div key={i} className={claseContenedor}>
        {avatarIA}
        <div className={styles.mensajeColumna}>
          <div className={styles.mensajeBurbuja}>
            <ReactMarkdown>{m.texto}</ReactMarkdown>
          </div>
          {citaciones}
        </div>
      </div>
    );
  });


  // Dots de "pensando": se muestran mientras esperamos el PRIMER token (la IA aun no ha creado su burbuja)
  let animacionCargando = null;
  const ultimo = mensajes[mensajes.length - 1];
  const esperandoPrimerToken = cargando && (!ultimo || ultimo.rol === 'usuario');
  if (esperandoPrimerToken) {
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


  //Renderizado
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
          placeholder="Escribe tu mensaje..."
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

      {/* Modal de previsualizacion del archivo citado */}
      {archivoModal && (
        <div className={styles.modalOverlay} onClick={function () { setArchivoModal(null); }}>
          <div className={styles.modalContenido} onClick={function (e) { e.stopPropagation(); }}>
            <div className={styles.modalCabecera}>
              <span className={styles.modalTitulo}>{archivoModal.rutaRelativa}</span>
              <button className={styles.modalCerrar} onClick={function () { setArchivoModal(null); }}>×</button>
            </div>
            <pre className={styles.modalCodigo}>{archivoModal.contenido}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
