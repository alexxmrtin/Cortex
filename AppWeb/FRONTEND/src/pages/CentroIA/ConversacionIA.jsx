import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import styles from '../../styles/CentroIA.module.css';
import apiClient from '../../services/api';

export default function ConversacionIA() {
  const { id } = useParams(); //Id de la conversacion activa, leido de la URL /centroIA/conversacion/:id

  const [mensajes, setMensajes] = useState([]); //Array que guarda los mensajes de la conversacion en formato { rol: 'usuario' o 'ia', texto: '...' }
  const [input, setInput] = useState(''); //texto que escribe el usuario 
  const [cargando, setCargando] = useState(false); //Interruptor para saber si la ia esta constando o no
  const [error, setError] = useState('');

  // useRef para hacer scroll automático al fondo del chat cuando llega un mensaje nuevo, es como un ancla que pones al final de la conversacion
  const mensajesEndRef = useRef(null);


  // Carga los mensajes de esta conversación desde la API al entrar, y cada vez que cambia el id de la conversacion
  useEffect(function () {

    async function cargarMensajes() {
      try {
        const respuesta = await apiClient.get('/mensajes/conversacion/' + id);

        // La API devuelve { id, contenido, rol, fecha }, mapeamos solo el rol y el contenido de la respuesta de la API y creamos una entrada en Mensajes[] que es un diccionario con dos pares clave-valor usando respuesta.data.rol y respuesta.data.contenido
        setMensajes(respuesta.data.map(function (m) {
          return { rol: m.rol, texto: m.contenido };
        }));
      } catch (err) {
        console.error('Error al cargar los mensajes', err);
      }
    }

    cargarMensajes();

  }, [id]);


  // Scroll automático al fondo cada vez que llega un mensaje nuevo, cada vez que cambia el estado mensajes se ejecuta un scroll usando ese input invisible o ancla al final de la conversacion
  useEffect(function () {
    if (mensajesEndRef.current) {
      mensajesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes]);



  
  async function enviarMensaje(e) {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || cargando) return;

    setMensajes(function (prev) { return [...prev, { rol: 'usuario', texto }]; });
    setInput('');
    setCargando(true);

    try {
      // Llama al backend, que guarda el mensaje, llama a la IA y devuelve su respuesta
      const respuesta = await apiClient.post('/mensajes/conversacion/' + id + '/chat', { contenido: texto });
      setMensajes(function (prev) { return [...prev, { rol: 'ia', texto: respuesta.data.contenido }]; });
    } 
    
    catch (err){
      if (err.response.status == 500) {
        setError(`${err.response.data.detail.split(' ').slice(0, 5).join(' ')}. El modelo no esta disponible en este momento`);
      }
      else if (err.response.status == 429) {
        setError(err.response.data.detail); //El usuario ha superado las 30 peticiones diarias
      }
       else {
        setError('No se pudo conectar con el servidor.');
      }
    }
    
    finally {
      setCargando(false);
    }
  }


  //Este bloque prepara lo que se va a enseñar en la conversacion, recorremos el array mensajes y dependiendo de si el rol es ia o usuario le aplica un estilo u otro
  const itemsMensajes = mensajes.map(function (m, i) {
    const claseContenedor = m.rol === 'usuario' ? styles.mensajeUsuario : styles.mensajeIA;

    let avatarIA = null; // Empezamos asumiendo que no hay avatar (como el usuario)
    
    if (m.rol === 'ia') {
      avatarIA = (
        <div className={styles.iaAvatar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>
          </svg>
        </div>
      );
    }

    // Decidimos qué renderizar dentro de la burbuja
    let contenidoBurbuja;
    if (m.rol === 'ia') {
      // Necesitamos ReactMarkdown ya que algunsa ias como Llama utilizan este formato de texto
      contenidoBurbuja = <ReactMarkdown>{m.texto}</ReactMarkdown>;
    } else {
      contenidoBurbuja = m.texto;
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


  //Si el estado cargando es true, dibuja un 
  let animacionCargando = null; // Por defecto, no mostramos nada
  
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
    </div>
  );
}
