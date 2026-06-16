import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/ActualizarProyecto.module.css';
import subidaStyles from '../../styles/AgregarProyecto.module.css';
import apiClient from '../../services/api';


// Panel para actualizar un proyecto. Tiene tres secciones:
//   1. Nombre               -> editar el nombre del proyecto
//   2. Archivos del proyecto -> subir archivos/carpeta (el mismo proyecto con cambios u otro distinto)
//   3. Descripcion          -> editar la descripcion del proyecto
// Hay un unico boton de submit abajo. (La subida de archivos todavia NO se manda al backend.)
export default function ActualizarProyecto() {
  const { id } = useParams(); // id del proyecto leido de la URL /proyectos/:id/actualizar
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');

  const [archivos, setArchivos] = useState([]); // archivos seleccionados: { archivo: File, rutaRelativa: string }

  // Refs a los <input type="file"> ocultos que abren el explorador (uno para archivos sueltos, otro para carpeta)
  const inputArchivosRef = useRef(null);
  const inputCarpetaRef = useRef(null);


  // Al entrar pedimos el proyecto al backend y rellenamos los campos con sus valores actuales
  useEffect(function () {
    async function cargarProyecto() {
      try {
        const respuesta = await apiClient.get('/proyectos/' + id);
        setNombre(respuesta.data.nombreproyecto || '');
        setDescripcion(respuesta.data.descripcion || '');
      } catch (err) {
        console.error('Error al cargar el proyecto', err);
        setError(err.response?.data?.detail || 'No se pudo cargar el proyecto');
      }
    }
    cargarProyecto();
  }, [id]);


  // Guarda nombre y descripcion y, si el usuario ha metido archivos, reemplaza los del proyecto: borra todos los actuales y sube los nuevos.
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    //Si falla la subida de archivos al servidor, la actualizacion del nombre y la descripcion no fallan ya que van antes del bloque de subida
    try {
      // 1. Guardamos nombre y descripcion
      await apiClient.patch('/proyectos/' + id, {
        nombreproyecto: nombre,
        descripcion: descripcion
      });

      // 2. Solo tocamos los archivos si el usuario ha seleccionado alguno.
      //    Asi, editar solo el nombre/descripcion no borra los ficheros del proyecto.
      if (archivos.length > 0) {

        // 2a. Obtenemos todos los archivos actuales del proyecto y los borramos uno a uno
        const respuestaArchivos = await apiClient.get('/archivos/proyecto/' + id);
        for (let i = 0; i < respuestaArchivos.data.length; i++) {
          await apiClient.delete('/archivos/' + respuestaArchivos.data[i].id);
        }

        // 2b. Subimos los archivos que ha metido el usuario (igual que en AgregarProyecto)
        for (let i = 0; i < archivos.length; i++) {
          const formData = new FormData(); // multipart/form-data para poder enviar el binario
          formData.append('archivo', archivos[i].archivo);
          formData.append('rutaRelativa', archivos[i].rutaRelativa);

          await apiClient.post('/archivos/proyecto/' + id, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      }

      // Al terminar, volvemos al panel del proyecto (que ya mostrara los datos y archivos nuevos)
      navigate('/proyectos/' + id);
    } catch (err) {
      console.error('Error al actualizar el proyecto', err);
      setError(err.response?.data?.detail || 'No se pudo actualizar el proyecto');
    }
  }



  // ── Subida de archivos (misma logica que AgregarProyecto) ──
  

  // Convierte los File seleccionados en { archivo, rutaRelativa } y los añade al estado
  function agregarArchivos(nuevos) {
    const lista = [];
    for (let i = 0; i < nuevos.length; i++) {
      lista.push({
        archivo: nuevos[i],
        rutaRelativa: nuevos[i].webkitRelativePath || nuevos[i].name // ruta dentro de la carpeta, o solo el nombre
      });
    }
    setArchivos(function (prev) {
      return prev.concat(lista);
    });
  }

  function handleSeleccionArchivos(e) {
    agregarArchivos(e.target.files);
    e.target.value = ''; // reseteamos para poder volver a seleccionar lo mismo
  }

  function handleSeleccionCarpeta(e) {
    agregarArchivos(e.target.files);
    e.target.value = '';
  }

  // Elimina un archivo suelto por su indice
  function handleEliminarArchivo(indice) {
    setArchivos(function (prev) {
      const nueva = [];
      for (let i = 0; i < prev.length; i++) {
        if (i !== indice) {
          nueva.push(prev[i]);
        }
      }
      return nueva;
    });
  }

  // Elimina todos los archivos que pertenecen a una carpeta raiz
  function handleEliminarCarpeta(carpetaRaiz) {
    setArchivos(function (prev) {
      const nueva = [];
      for (let i = 0; i < prev.length; i++) {
        if (!prev[i].rutaRelativa.startsWith(carpetaRaiz + '/')) {
          nueva.push(prev[i]);
        }
      }
      return nueva;
    });
  }



  // Construye la lista visible de archivos: las carpetas se muestran una sola vez por su raiz
  const listaArchivos = [];
  const carpetasVistas = [];
  for (let i = 0; i < archivos.length; i++) {
    const partes = archivos[i].rutaRelativa.split('/');

    if (partes.length > 1) {
      // El archivo viene de una carpeta: mostramos solo la carpeta raiz una vez
      const carpetaRaiz = partes[0];

      let yaVista = false;
      for (let j = 0; j < carpetasVistas.length; j++) {
        if (carpetasVistas[j] === carpetaRaiz) {
          yaVista = true;
          break;
        }
      }

      if (!yaVista) {
        carpetasVistas.push(carpetaRaiz);
        listaArchivos.push(
          <div key={'carpeta-' + carpetaRaiz} className={subidaStyles.archivoItem}>
            <span className={subidaStyles.archivoNombre}>{carpetaRaiz}</span>
            <button
              type="button"
              className={subidaStyles.archivoEliminar}
              onClick={function () { handleEliminarCarpeta(carpetaRaiz); }}
            >
              ✕
            </button>
          </div>
        );
      }
    } else {
      // Archivo suelto
      const indice = i;
      listaArchivos.push(
        <div key={i} className={subidaStyles.archivoItem}>
          <span className={subidaStyles.archivoNombre}>{archivos[i].rutaRelativa}</span>
          <button
            type="button"
            className={subidaStyles.archivoEliminar}
            onClick={function () { handleEliminarArchivo(indice); }}
          >
            ✕
          </button>
        </div>
      );
    }
  }


  return (
    <form className={styles.panel} onSubmit={handleSubmit}>
      <h2 className={styles.titulo}>Actualizar proyecto</h2>

      {/* Seccion 1: nombre */}
      <div className={styles.seccion}>
        <h3 className={styles.seccionTitulo}>Nombre</h3>
        <input
          className={styles.input}
          value={nombre}
          onChange={function (e) { setNombre(e.target.value); }}
        />
      </div>

      {/* Seccion 2: subir archivos del proyecto */}
      <div className={styles.seccion}>
        <h3 className={styles.seccionTitulo}>Archivos del proyecto</h3>
        <p className={styles.placeholder}>Sube tu proyecto (puede ser el mismo con cambios o uno distinto)</p>

        <div className={subidaStyles.zonaBotones}>
          <button type="button" className={subidaStyles.zonaBoton} onClick={function () { inputArchivosRef.current.click(); }}>
            Subir archivos
          </button>
          <button type="button" className={subidaStyles.zonaBoton} onClick={function () { inputCarpetaRef.current.click(); }}>
            Subir carpeta
          </button>
        </div>

        {/* Inputs ocultos que abren el explorador (los botones de arriba los disparan via ref) */}
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

        {/* Lista de lo seleccionado, solo si hay algo */}
        {archivos.length > 0 && (
          <div className={subidaStyles.listaArchivos}>
            {listaArchivos}
          </div>
        )}
      </div>

      {/* Seccion 3: descripcion */}
      <div className={styles.seccion}>
        <h3 className={styles.seccionTitulo}>Descripción</h3>
        <textarea
          className={styles.textarea}
          placeholder="Escribe una descripción del proyecto..."
          value={descripcion}
          onChange={function (e) { setDescripcion(e.target.value); }}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button type="submit" className={styles.guardar}>Guardar cambios</button>
    </form>
  );
}
