import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styles from '../../styles/ServicesPanel.module.css';
import apiClient from '../../services/api';

export default function ServicesPanel() {
  const { id } = useParams();
  
  const [servicio, setServicio] = useState(null);
  const [proyecto, setProyecto] = useState(null); // Proyecto asociado al servicio, se carga si proyectoAsociado tiene valor
  const [vivo, setVivo] = useState(null); // null = comprobando, true = responde, false = no responde (Saber si un servicio esta activo, la API devuelve true o false)
  const [cargando, setCargando] = useState(true);

  useEffect(function() {
    async function cargarDatos() {
      const respuesta = await apiClient.get('/servicios/' + id);
      setServicio(respuesta.data);
      setCargando(false);

      // Si el servicio tiene proyecto asociado, recogemos el proyecto de la API
      if (respuesta.data.proyectoAsociado) {
        const respProyecto = await apiClient.get('/proyectos/' + respuesta.data.proyectoAsociado);
        setProyecto(respProyecto.data);
      }

      // Una vez cargado el servicio, hacemos el ping para saber si esta vivo
      const ping = await apiClient.get('/servicios/' + id + '/ping');
      setVivo(ping.data.vivo);

      // Actualizamos el estado segun el resultado del ping
      let nuevoEstado;
      if (ping.data.vivo) {
        nuevoEstado = 'activo';
      } else {
        nuevoEstado = 'inactivo';
      }
      const actualizado = await apiClient.patch('/servicios/' + id, { estado: nuevoEstado });
      setServicio(actualizado.data);
    }
    cargarDatos();
  }, [id]);

  // Alterna el estado entre 'activo' e 'inactivo' en la base de datos
  async function toggleEstado() {
    const nuevoEstado = servicio.estado === 'activo' ? 'inactivo' : 'activo';
    const respuesta = await apiClient.patch('/servicios/' + id, { estado: nuevoEstado });
    setServicio(respuesta.data);
  }

  if (cargando) {
    return <p className={styles.noEncontrado}>Cargando...</p>;
  }

  if (!servicio) {
    return <p className={styles.noEncontrado}>Servicio no encontrado.</p>;
  }

  
  let claseEstado;
  let textoEstado;
  if (servicio.estado === 'activo') {
    claseEstado = styles.estadoActivo;
    textoEstado = 'Activo';
  } else {
    claseEstado = styles.estadoInactivo;
    textoEstado = 'Inactivo';
  }


  let claseEstadoBadge;
  if (servicio.estado === 'activo') {
    claseEstadoBadge = styles.estadoActivoBadge;
  } else {
    claseEstadoBadge = styles.estadoInactivoBadge;
  }


  // Texto del ping: null mientras comprueba, luego si responde o no
  let textoPing;
  if (vivo === null) {
    textoPing = 'Comprobando...';
  } else if (vivo) {
    textoPing = 'Responde';
  } else {
    textoPing = 'No responde';
  }

  return (
    <div className={styles.panel}>

      <div className={styles.cabecera}>
        <div>
          <h2 className={styles.titulo}>{servicio.nombre}</h2>
          <span className={styles.subtitulo}>{servicio.tipo}</span>
        </div>
        <button className={claseEstado} onClick={toggleEstado}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
          {textoEstado}
        </button>
      </div>

      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Tipo de servidor</span>
          <span className={styles.infoValor}>{servicio.tipo}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Proyecto asociado</span>
          {proyecto
            ? <Link to={'/proyectos/' + proyecto.id} className={styles.infoValor}>{proyecto.nombreproyecto}</Link>
            : <span className={styles.infoValor}>—</span>
          } {/*Si el estado proyecto es null, se interpreta como false entonces mostrara el <span> */}
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Estado</span>
          <span className={claseEstadoBadge}>{textoEstado}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Host</span>
          <span className={styles.infoValor}>{servicio.host}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Puerto</span>
          <span className={styles.infoValor}>{servicio.puerto}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Conectividad</span>
          <span className={styles.infoValor}>{textoPing}</span>
        </div>
      </div>

      <div className={styles.descripcionBloque}>
        <label className={styles.descripcionLabel} htmlFor="descripcion">Descripción</label>
        <textarea
          id="descripcion"
          className={styles.descripcionTexto}
          placeholder="Escribe una descripción del servicio..."
          value={servicio.descripcion || ''}
          onChange={function(e) { setServicio({ ...servicio, descripcion: e.target.value }); }}
        />
      </div>

    </div>
  );
}
