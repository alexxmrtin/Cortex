import { useState, useEffect, useRef } from 'react';
import apiClient from '../services/api';
import styles from '../styles/SelectorModelo.module.css';

//Modelos disponibles en la app (Qwen3 es el modelo por defecto)
const MODELOS = [
  { id: 'qwen/qwen3-32b', nombre: 'Qwen3 32B', proveedor: 'Groq' },
  { id: 'gemini-2.0-flash', nombre: 'Gemini 2.0 Flash', proveedor: 'Google' },
  { id: 'claude-sonnet-4-6', nombre: 'Claude Sonnet 4.6', proveedor: 'Anthropic' },
  { id: 'llama-3.3-70b-versatile', nombre: 'Llama 3.3 70B', proveedor: 'Groq' },
];

//Esta funcion se usa para la conversion, el usuario guarda el MODELOS.id en la base de datos, mientras que en el dom vamos a usar MODELOS.nombre, por tanto esta funcion le pasamos el modelo de la base de datos y nos devuelve el nombre
function getNombreModelo(modeloId) {
  const modelo = MODELOS.find(function (modeloItem) { return modeloItem.id === modeloId; });
  if (modelo) {
    return modelo.nombre;
  } else {
    return modeloId;
  }
}


//FUNCION PRINCIPAL
export default function SelectorModelo({ modeloActual, onCambiar }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [estadoModelo, setEstadoModelo] = useState('comprobando');
  const wrapperRef = useRef(null);


  //Esto consume 1 token de la IA, esta implementado caching de 15 segundos para reducir el consumo de tokens
  useEffect(function () {
    setEstadoModelo('comprobando');
    apiClient.get('/mensajes/health')
      .then(function (res) {
        if (res.data.estado === 'ok') {
          setEstadoModelo('ok');
        } else {
          setEstadoModelo('error');
        }
      })
      .catch(function () {
        setEstadoModelo('error');
      });
  }, [modeloActual]);


  //Cierra el panel cuando el usuario hace click fuera del componente
  useEffect(function () {
    if (!abierto) return;
    function handleClickFuera(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFuera);
    return function () { document.removeEventListener('mousedown', handleClickFuera); };
  }, [abierto]);



  //Guarda el modelo seleccionado en la base de datos y notifica al componente padre para que actualice su estado
  async function seleccionarModelo(modeloId) {
    
    if (modeloId === modeloActual || cargando) return;
    
    setCargando(true);
    try {
      await apiClient.patch('/usuarios/me', { modeloIA: modeloId });
      onCambiar(modeloId); //
    } catch (err) {
      console.error('Error al cambiar el modelo', err);
    }
    
    setCargando(false);
    setAbierto(false);
  }


  let dotClass = styles.dot + ' ';
  if (estadoModelo === 'ok') {
    dotClass = dotClass + styles.dotOk;
  } else if (estadoModelo === 'error') {
    dotClass = dotClass + styles.dotError;
  } else {
    dotClass = dotClass + styles.dotComprobando;
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.badgeWrapper}>
        
        {abierto && (
          <div className={styles.panel}>
            <p className={styles.panelTitulo}>Modelo de IA</p>
            {MODELOS.map(function (modelo) {
              let itemClass = styles.modeloItem;
              //modelo.id lo obtenemos del componente padre, que nos lo pasa como prop
              if (modelo.id === modeloActual) {
                itemClass = itemClass + ' ' + styles.modeloItemActivo;
              }

              return (
                <button
                  key={modelo.id}
                  className={itemClass}
                  onClick={function () { seleccionarModelo(modelo.id); }}
                  disabled={cargando}
                >
                  <span className={styles.modeloNombre}>{modelo.nombre}</span>
                  <span className={styles.modeloProveedor}>{modelo.proveedor}</span>
                </button>
              );
            })}
          </div>
        )}

        <button className={styles.badge} onClick={function () { setAbierto(!abierto); }}>
          <span className={dotClass} />
          <div className={styles.texto}>
            <span className={styles.label}>Modelo</span>
            <span className={styles.nombre}>{getNombreModelo(modeloActual) || '...'}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
