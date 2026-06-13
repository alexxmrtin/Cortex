import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import styles from '../../styles/CentroIA.module.css';
import apiClient from '../../services/api';

export default function ConversacionIA() {
  const { id } = useParams(); //Id de la conversacion activa, leido de la URL /centroIA/conversacion/:id

  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // useRef para hacer scroll automático al fondo del chat cuando llega un mensaje nuevo
  const mensajesEndRef = useRef(null);


  // Carga los mensajes de esta conversación desde la API al entrar, y cada vez que cambia el id
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


  // Scroll automático al fondo cada vez que llega un mensaje nuevo
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
      // Llama al backend, que guarda el mensaje, llama a Gemini y devuelve la respuesta de la IA
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


  const itemsMensajes = mensajes.map(function (m, i) {
    const claseContenedor = m.rol === 'usuario' ? styles.mensajeUsuario : styles.mensajeIA;

    const avatarIA = m.rol === 'ia' ? (
      <div className={styles.iaAvatar}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>
        </svg>
      </div>
    ) : null;

    return (
      <div key={i} className={claseContenedor}>
        {avatarIA}
        <div className={styles.mensajeBurbuja}>{m.texto}</div>
      </div>
    );
  });


  const animacionCargando = cargando ? (
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
  ) : null;

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
