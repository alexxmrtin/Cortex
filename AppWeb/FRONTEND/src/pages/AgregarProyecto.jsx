import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/AgregarProyecto.module.css';

export default function AgregarProyecto() {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [archivos, setArchivos] = useState([]);
  const [arrastrandoSobre, setArrastrandoSobre] = useState(false);

  const inputArchivosRef = useRef(null);
  const inputCarpetaRef = useRef(null);

  function handleNombreChange(e) {
    setNombre(e.target.value);
  }

  function handleDescripcionChange(e) {
    setDescripcion(e.target.value);
  }

  function agregarArchivos(nuevos) {
    const lista = [];
    for (let i = 0; i < nuevos.length; i++) {
      lista.push(nuevos[i]);
    }
    setArchivos(function(prev) {
      return prev.concat(lista);
    });
  }

  function handleSeleccionArchivos(e) {
    agregarArchivos(e.target.files);
    e.target.value = '';
  }

  function handleSeleccionCarpeta(e) {
    agregarArchivos(e.target.files);
    e.target.value = '';
  }

  function handleEliminarArchivo(indice) {
    setArchivos(function(prev) {
      const nueva = [];
      for (let i = 0; i < prev.length; i++) {
        if (i !== indice) {
          nueva.push(prev[i]);
        }
      }
      return nueva;
    });
  }

  function handleDragOver(e) {
    e.preventDefault();
    setArrastrandoSobre(true);
  }

  function handleDragLeave() {
    setArrastrandoSobre(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setArrastrandoSobre(false);
    agregarArchivos(e.dataTransfer.files);
  }

  function handleSubmit(e) {
    e.preventDefault();

    // TODO: reemplazar con llamada real al backend
    // const formData = new FormData();
    // formData.append('nombre', nombre);
    // formData.append('descripcion', descripcion);
    // for (let i = 0; i < archivos.length; i++) {
    //   formData.append('archivos', archivos[i]);
    // }
    // fetch('/api/proyectos', {
    //   method: 'POST',
    //   headers: { Authorization: 'Bearer ' + token },
    //   body: formData,
    // })
    //   .then(function(res) { return res.json(); })
    //   .then(function(data) { navigate('/proyectos/' + data.id); });

    navigate('/proyectos');
  }

  function handleCancelar() {
    navigate('/proyectos');
  }

  const listaArchivos = [];
  for (let i = 0; i < archivos.length; i++) {
    const indice = i;
    listaArchivos.push(
      <div key={i} className={styles.archivoItem}>
        <span className={styles.archivoNombre}>{archivos[i].webkitRelativePath || archivos[i].name}</span>
        <button
          type="button"
          className={styles.archivoEliminar}
          onClick={function() { handleEliminarArchivo(indice); }}
        >
          ✕
        </button>
      </div>
    );
  }

  let zonaClass = styles.zonaSubida;
  if (arrastrandoSobre) {
    zonaClass = zonaClass + ' ' + styles.zonaSubidaActiva;
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <div className={styles.cardHeader}>
          <h1 className={styles.title}>Nuevo Proyecto</h1>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="nombre">Nombre del proyecto</label>
            <input
              id="nombre"
              type="text"
              className={styles.input}
              placeholder="Mi proyecto"
              value={nombre}
              onChange={handleNombreChange}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="descripcion">Descripción</label>
            <textarea
              id="descripcion"
              className={styles.input}
              placeholder="Describe brevemente el proyecto..."
              value={descripcion}
              onChange={handleDescripcionChange}
              rows={4}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Archivos</label>
            <div
              className={zonaClass}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p className={styles.zonaTexto}>Arrastra archivos o carpetas aquí</p>
              <div className={styles.zonaBotones}>
                <button type="button" className={styles.zonaBoton} onClick={function() { inputArchivosRef.current.click(); }}>
                  Subir archivos
                </button>
                <button type="button" className={styles.zonaBoton} onClick={function() { inputCarpetaRef.current.click(); }}>
                  Subir carpeta
                </button>
              </div>
            </div>

            <input
              ref={inputArchivosRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleSeleccionArchivos}
            />
            <input
              ref={inputCarpetaRef}
              type="file"
              multiple
              webkitdirectory=""
              style={{ display: 'none' }}
              onChange={handleSeleccionCarpeta}
            />

            {archivos.length > 0 && (
              <div className={styles.listaArchivos}>
                {listaArchivos}
              </div>
            )}
          </div>

          <button type="submit" className={styles.button}>
            Crear proyecto
          </button>

          <button type="button" className={styles.buttonSecundario} onClick={handleCancelar}>
            Cancelar
          </button>
        </form>

      </div>
    </div>
  );
}