import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import styles from '../styles/ServicesPanel.module.css';

// TODO: reemplazar con datos reales del backend (GET /api/servicios/:id)
const datosDePrueba = {
  1: { nombre: 'Servidor Web Cortex', tipo: 'Nginx', proyecto: 'Proyecto 1', proyectoId: 1, activo: true, puerto: 80 },
  2: { nombre: 'Base de Datos Cortex', tipo: 'PostgreSQL', proyecto: 'Proyecto 1', proyectoId: 1, activo: false, puerto: 5432 },
  3: { nombre: 'Caché', tipo: 'Redis', proyecto: 'Proyecto 2', proyectoId: 2, activo: true, puerto: 6379 },
  4: { nombre: 'Autenticación', tipo: 'OAuth2', proyecto: 'Proyecto 3', proyectoId: 3, activo: false, puerto: 8080 },
};

export default function ServicesPanel() {
  const { id } = useParams();
  const servicio = datosDePrueba[id];
  const [descripcion, setDescripcion] = useState('');

  if (!servicio) {
    return <p className={styles.noEncontrado}>Servicio no encontrado.</p>;
  }

  let claseEstado;
  let claseEstadoBadge;
  let textoEstado;
  if (servicio.activo) {
    claseEstado = styles.estadoActivo;
    claseEstadoBadge = styles.estadoActivoBadge;
    textoEstado = 'Activo';
  } else {
    claseEstado = styles.estadoInactivo;
    claseEstadoBadge = styles.estadoInactivoBadge;
    textoEstado = 'Inactivo';
  }

  // TODO: conectar con el backend para activar/desactivar el servicio
  function toggleEstado() {
  }

  return (
    <div className={styles.panel}>

      <div className={styles.cabecera}>
        <div>
          <h2 className={styles.titulo}>{servicio.nombre}</h2>
          <span className={styles.subtitulo}>{servicio.tipo}</span>
        </div>
        <button className={claseEstado} onClick={toggleEstado}>{textoEstado}</button>
      </div>

      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Tipo de servidor</span>
          <span className={styles.infoValor}>{servicio.tipo}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Proyecto asociado</span>
          <Link to={'/proyectos/' + servicio.proyectoId} className={styles.infoLink}>{servicio.proyecto}</Link>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Estado</span>
          <span className={claseEstadoBadge}>{textoEstado}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Puerto</span>
          <span className={styles.infoValor}>{servicio.puerto}</span>
        </div>
      </div>

      <div className={styles.descripcionBloque}>
        <label className={styles.descripcionLabel} htmlFor="descripcion">Descripción</label>
        <textarea
          id="descripcion"
          className={styles.descripcionTexto}
          placeholder="Escribe una descripción del servicio..."
          value={descripcion}
          onChange={function (e) { setDescripcion(e.target.value); }}
        />
      </div>

    </div>
  );
}
