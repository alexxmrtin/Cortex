import { useState } from 'react';
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

  
  // Crea una conversación en la BD con el texto de la sugerencia como título y navega a ella pasando el texto como mensaje inicial via router state.
  // ConversacionIA lo recoge con useLocation().state?.mensajeInicial
  async function handleSugerencia(texto) {
    setCargando(true);
    const respuesta = await apiClient.post('/conversaciones/', { titulo: texto }); //Creamos una nueva conversacion en la bd
    const conversacionId = respuesta.data.id;

    await apiClient.post('/mensajes/conversacion/' + conversacionId, { contenido: texto, rol: 'usuario' }); //Guardamos el primer mensaje en la bd

    navigate('/centroIA/conversacion/' + conversacionId); //Navegamos a la conversacion, ConversacionIA cargara el mensaje desde la API
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
              <button key={s} className={styles.sugerencia} disabled={cargando} onClick={function () { handleSugerencia(s); }}>
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Input fijo en la parte inferior*/}
      <form 
        className={styles.inputArea} 
        onSubmit={function (e) { 
            e.preventDefault();

            //Si no esta vacio, se ejecuta la funcion handleSugerencia con el contenido del estado Input
            if(input.trim()){ 
              handleSugerencia(input.trim()); 
            }
        }}>

        <input
          className={styles.input}
          type="text"
          placeholder="Escribe tu mensaje..."
          value={input}
          onChange={function (e) { setInput(e.target.value); } /*El valor que escribe el usuario en el input lo ponemos en el estado Input */}
          disabled={cargando}
        />

        <button className={styles.enviarBtn} type="submit" disabled={!input.trim() || cargando /*Si esta vacio o cargando se deshabilita el boton*/}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>

      </form>
    </div>
  );
}
