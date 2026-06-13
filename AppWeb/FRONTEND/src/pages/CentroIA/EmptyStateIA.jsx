import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/CentroIA.module.css';
import apiClient from '../../services/api';

const SUGERENCIAS = [
  'Desactiva un servicio',
  'Resume un proyecto',
  'Crea un README de un proyecto',
];

export default function EmptyStateIA() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState('');

  // Cargamos los proyectos del usuario para que pueda vincular la conversación a uno
  useEffect(function () {
    apiClient.get('/proyectos/').then(function (res) {
      setProyectos(res.data);
    }).catch(function () {});
  }, []);


  // Crea una conversación, llama al chat de IA con el primer mensaje y navega a ella.
  // Al llegar a ConversacionIA, ya hay respuesta de Gemini cargada en la BD.
  async function handleMensajeInicio(texto) {
    setCargando(true);
    let conversacionId = null; //Guardamos el id aqui para poder acceder a el en el catch

    try {
      //Obtenemos del input del usuario las primeras 4 palabras, si hay 4 o mas palabras añade 3 puntos al final
      const palabras = texto.split(' ');
      let titulo = palabras.slice(0, 3).join(' ');
      if (palabras.length >= 4) {
        titulo = titulo + '...';
      }

      //Creamos la conversacion, si el usuario a modificado el estado proyectoId usando el input grafico de seleccion, creamos una conversacion con el id del proyecto, para que tenga los archivos disponibles
      const cuerpo = { titulo: titulo };
      if (proyectoId) {
        cuerpo.proyecto_id = parseInt(proyectoId);
      }

      const respuesta = await apiClient.post('/conversaciones/', cuerpo); //Creamos una nueva conversacion en la bd
      conversacionId = respuesta.data.id;


      // Usamos el endpoint de chat: guarda el mensaje del usuario, llama a la IA y guarda la respuesta
      await apiClient.post('/mensajes/conversacion/' + conversacionId + '/chat', { contenido: texto });

      navigate('/centroIA/conversacion/' + conversacionId); //Navegamos a la conversacion, ConversacionIA cargara el mensaje desde la API
    } catch (err) {

      if (err.response.status == 500) {
        setError(`${err.response.data.detail.split(' ').slice(0, 5).join(' ')}. El modelo no esta disponible en este momento`);
      }
      else if (err.response.status == 429) {
        setError(err.response.data.detail); //El usuario ha superado las 30 peticiones diarias
      }
      else {
        setError('No se pudo conectar con el servidor.');
      }

      // Si la conversacion ya fue creada pero el chat fallo, la borramos para no dejarla huerfana en la BD
      if (conversacionId) {
        await apiClient.delete('/conversaciones/' + conversacionId).catch(function() {});
      }
      setCargando(false);
    }
  }


  return (
    <div className={styles.emptyState}>

      {/* Contenido centrado — icono, título y sugerencias */}
      <div className={styles.emptyStateContenido}>
        <div className={styles.emptyIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="5"/>
            <circle cx="12" cy="2" r="0.5" fill="currentColor"/>
            <rect x="4" y="5" width="16" height="14" rx="2"/>
            <circle cx="9" cy="11" r="2"/>
            <circle cx="15" cy="11" r="2"/>
            <path d="M8 15h8"/>
            <line x1="4" y1="12" x2="2" y2="12"/>
            <line x1="20" y1="12" x2="22" y2="12"/>
          </svg>
        </div>
        <h2 className={styles.emptyTitle}>Asistente IA</h2>
        <p className={styles.emptySubtitle}>Inicia una nueva conversación o selecciona una del historial</p>

        <div className={styles.sugerencias}>
          {SUGERENCIAS.map(function (s) {
            return (
              <button key={s} className={styles.sugerencia} disabled={cargando} onClick={function () { handleMensajeInicio(s); }}>
                {s}
              </button>
            );
          })}
        </div>

      </div>

      {/* Mensaje de error visible para el usuario */}
      {error && <p className={styles.errorMensaje}>{error}</p>}

      {/* Selector de proyecto — solo aparece si el usuario tiene proyectos */}
      {proyectos.length > 0 && (
        <div className={styles.selectorProyecto}>
          <label className={styles.selectorProyectoLabel}>Contexto de proyecto</label>
          <select
            className={styles.selectorProyectoSelect}
            value={proyectoId}
            onChange={function (e) { setProyectoId(e.target.value); }}
            disabled={cargando}
          >
            <option value="">Sin contexto</option>
            {proyectos.map(function (p) {
              return <option key={p.id} value={p.id}>{p.nombreproyecto}</option>;
            })}
          </select>
        </div>
      )}

      {/* Input fijo en la parte inferior */}
      <form
        className={styles.inputArea}
        onSubmit={function (e) {
          e.preventDefault();
          if (input.trim()) {
            handleMensajeInicio(input.trim());
          }
        }}>

        <input
          className={styles.input}
          type="text"
          placeholder="Escribe tu mensaje..."
          value={input}
          onChange={function (e) { setInput(e.target.value); setError(''); }}
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
