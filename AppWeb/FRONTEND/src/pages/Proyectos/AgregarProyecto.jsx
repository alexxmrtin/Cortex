import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/AgregarProyecto.module.css';
import apiClient from '../../services/api';

/*
FLUJO COMPLETO PARA SUBIR UN ARCHIVO:
1. Selección — el input con webkitdirectory te da todos los archivos de la carpeta, ya aplanados. Si la carpeta tiene 50 archivos en 10 subcarpetas, recibes un array de 50 File objects, cada uno con su webkitRelativePath.

2. Estado — cada uno se guarda como { archivo, rutaRelativa } en el array archivos.

3. Submit — se hace un POST /archivos/proyecto/{id} por cada elemento del array. Si hay 50 archivos, son 50 requests HTTP separadas, una detrás de otra (el await dentro del for lo hace secuencial).

El backend recibe cada request, crea los directorios que falten usando rutaRelativa, y guarda el archivo en disco + un registro en la BD.*/



export default function AgregarProyecto() {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [archivos, setArchivos] = useState([]); //Aqui se guardan los archivos seleccionados, se inicializan vacios
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  //Estos refs se van a usar para apuntar a unos <input> lo cuales abren el explorador de archivos o carpetas
  const inputArchivosRef = useRef(null);
  const inputCarpetaRef = useRef(null);


  //"e" es el evento que ocurre en el dom y que maneja estos handlers
  function handleNombreChange(e) {
    setNombre(e.target.value);
  }
  function handleDescripcionChange(e) {
    setDescripcion(e.target.value);
  }


  //Declaramos una constante donde vamos a guardar todos los archivos que queremos subir
  //Cada elemento del estado es {archivo: File, rutaRelativa: string} en vez de solo File, asi la ruta queda fijada en el momento de añadir el archivo y no hay que recalcularla despues
  function agregarArchivos(nuevos) {
    const lista = [];
    for (let i = 0; i < nuevos.length; i++) {
      lista.push({
        archivo: nuevos[i],//Esto es el objeto File con metadatos del archivo
        rutaRelativa: nuevos[i].webkitRelativePath || nuevos[i].name //webkitRelatiePath nos da la ruta relativa de los elementos que seleccionamos
      });
    }
    //setArchivos es el estado archivos,prev es un array de archivos que ya existia antes en el estado archivos
    setArchivos(function(prev) {
      return prev.concat(lista);
    });
  }


  //Manejadores que llaman a la funcion agregarArchivos para meter el archivo o carpeta dentro, resetea el evento a ""
  function handleSeleccionArchivos(e) {
    agregarArchivos(e.target.files);
    e.target.value = '';
  }
  function handleSeleccionCarpeta(e) {
    agregarArchivos(e.target.files);
    e.target.value = '';
  }


  //Manejador que elimina un archivo en la constante lista segun el indice de un archivo
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

  //Manejador que elimina todos los archivos que pertenecen a una carpeta raiz
  function handleEliminarCarpeta(carpetaRaiz) {
    setArchivos(function(prev) {
      const nueva = [];
      for (let i = 0; i < prev.length; i++) {
        if (!prev[i].rutaRelativa.startsWith(carpetaRaiz + '/')) {
          nueva.push(prev[i]);
        }
      }
      return nueva;
    });
  }


  async function handleSubmit(e) {
    e.preventDefault();

    setCargando(true);
    setError('');

    try {
      // 1. Crear el proyecto
      const respuestaProyecto = await apiClient.post('/proyectos/', {
        nombreproyecto: nombre,
        descripcion: descripcion
      });
      const proyecto = respuestaProyecto.data; //Necesitas recoger el proyecto para luego subir los archivos y crear la carpeta en Storage


      // 2. Subir cada archivo al proyecto recien creado
      try {
        for (let i = 0; i < archivos.length; i++) {
          const formData = new FormData();//FormData es una clase nativa del navegador para construir formularios con datos en formato multipart/form-data. Este formato es necesario para subir archivos.

          //Aqui lo que haces es añadir dos pares clave-valor a la instancia formData
          formData.append('archivo', archivos[i].archivo);//Archivo binario
          formData.append('rutaRelativa', archivos[i].rutaRelativa);//ruta al archivo

          //Estamos usando el endpoint /archivos/proyecto/{id}, el endpoint ademas pide el archivo en binario y la ruta relativa del archivo, eso esta en formdata.
          await apiClient.post('/archivos/proyecto/' + proyecto.id, formData, {
            headers: { 'Content-Type': 'multipart/form-data' } //Esto es necesario ya que estamos enviando un archivo, sin esto axios pondria como Content-type: application/json y FastAPI lo parsearia a JSON.Ahora FastAPI sabe que tiene que buscar los campos File() y Form()
          });
        }
      }

      catch (err) {
        // Si falla la subida, borramos el proyecto para no dejarlo huerfano en la BD
        await apiClient.delete('/proyectos/' + proyecto.id);
        setError(err.response?.data?.detail || 'Error al subir los archivos');
        setCargando(false);
        return;
      }

      navigate('/proyectos/' + proyecto.id);
    }

    catch (err) {
      setError(err.response?.data?.detail || 'Error al crear el proyecto');
      setCargando(false);
    }
  }

  //Manejador del boton cancelar, te devuelve a /proyectos
  function handleCancelar() {
    navigate('/proyectos');
  }

//########################################################################################################

  //Contruye en el dom los archivos cargados por el usuario y los muestra en el DOM
  //Si un archivo viene de una carpeta (tiene "/" en su rutaRelativa), se muestra solo el nombre de la carpeta raiz y se salta el resto de archivos de esa misma carpeta para no repetirla
  const listaArchivos = [];
  const carpetasVistas = []; // Guardamos las carpetas raiz ya añadidas para no duplicarlas

  //Ten en cuenta que archivos[] va a tener cada archivo de la carpeta con su ruta relativa, cada archivo va a comenzar su ruta con el nombre de la raiz,por eso es necesario hacer esto
  for (let i = 0; i < archivos.length; i++) {
    const partes = archivos[i].rutaRelativa.split('/');

    if (partes.length > 1) {
      // El archivo pertenece a una carpeta, mostramos solo la carpeta raiz una vez
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
          <div key={'carpeta-' + carpetaRaiz} className={styles.archivoItem}>
            <span className={styles.archivoNombre}>{carpetaRaiz}</span>
            <button
              type="button"
              className={styles.archivoEliminar}
              onClick={function() { handleEliminarCarpeta(carpetaRaiz); }}
            >
              ✕
            </button>
          </div>
        );
      }
    } else {
      // Archivo individual, se muestra solo
      const indice = i;
      listaArchivos.push(
        <div key={i} className={styles.archivoItem}>
          <span className={styles.archivoNombre}>{archivos[i].rutaRelativa}</span>
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
  }
//###########################################################################################################

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

          {/*---------------------------------------------------------------------------------------- */}
          <div className={styles.field}>
            <label className={styles.label}>Archivos</label>

            <div className={styles.zonaBotones}>
              <button type="button" className={styles.zonaBoton} onClick={function() { inputArchivosRef.current.click(); }}>
                Subir archivos
              </button>
              <button type="button" className={styles.zonaBoton} onClick={function() { inputCarpetaRef.current.click(); }}>
                Subir carpeta
              </button>
            </div>

            {/*EStos input son necesarios para que se abra el explorador de archivos, nota como arriba, al hacer click en los botones, llamamos a inputArchivosRef.current.click(), llamamos a la referencia de estos inputs */}
            <input
              ref={inputArchivosRef}
              type="file"
              multiple
              style={{ display: 'none' }} //Display:none quiere decir que no salen en el dom, estan "escondidos"
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

            {/*Renderizamos el array listaArchivos que contruimos antes en el for, solo si el estado archivos contiene al menos 1 archivo */}
            {archivos.length > 0 && (
              <div className={styles.listaArchivos}>
                {listaArchivos}
              </div>
            )}
          </div>
          {/*----------------------------------------------------------------------------------------------- */}
          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.button} disabled={cargando}>
            {cargando ? 'Creando...' : 'Crear proyecto'/*cargando es un estado, dependiendo de si es true o false obtendra un string u otro */ }
          </button>

          <button type="button" className={styles.buttonSecundario} onClick={handleCancelar}>
            Cancelar
          </button>
        </form>

      </div>
    </div>
  );
}
