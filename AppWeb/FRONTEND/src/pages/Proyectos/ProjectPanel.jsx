import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/ProjectPanel.module.css';
import apiClient from '../../services/api';


function IconoCarpeta() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f0c040" stroke="#d4a000" strokeWidth="1.5">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function IconoArchivo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

//#################################################################################################

// Recibe una lista plana de archivos [{rutaRelativa: "src/components/App.jsx", ...}, ...] y devuelve un arbol de nodos {nombre, tipo, contenido} que FilaArchivo sabe renderizar.
// Para cada archivo, divide su rutaRelativa por "/" y va creando carpetas en el arbol si no existen todavia, hasta llegar al ultimo segmento que es el archivo.
function construirArbol(archivosPlanos) {
  const raiz = [];

  for (let i = 0; i < archivosPlanos.length; i++) {
    const partes = archivosPlanos[i].rutaRelativa.split('/');
    let nivelActual = raiz;

    // Recorremos todas las partes menos la ultima, que es el nombre del archivo
    for (let j = 0; j < partes.length - 1; j++) {
      const nombreCarpeta = partes[j];

      // Buscamos si ya existe una carpeta con ese nombre en el nivel actual
      let carpeta = null;
      for (let k = 0; k < nivelActual.length; k++) {
        if (nivelActual[k].nombre === nombreCarpeta && nivelActual[k].tipo === 'carpeta') {
          carpeta = nivelActual[k];
          break;
        }
      }

      // Si no existe la creamos y la añadimos al nivel actual
      if (!carpeta) {
        carpeta = { nombre: nombreCarpeta, tipo: 'carpeta', contenido: [] };
        nivelActual.push(carpeta);
      }

      nivelActual = carpeta.contenido; // Bajamos un nivel
    }

    // La ultima parte del array es el archivo. Guardamos tambien su id (viene de la API) para poder navegar luego a /proyectos/:id/archivo/:archivoId al clicar.
    nivelActual.push({ nombre: partes[partes.length - 1], tipo: 'archivo', id: archivosPlanos[i].id });
  }


  // Ordena recursivamente cada nivel poniendo carpetas antes que archivos_
  function ordenarNivel(nodos) {
    nodos.sort(function(a, b) {
      if (a.tipo === 'carpeta' && b.tipo === 'archivo') return -1;
      if (a.tipo === 'archivo' && b.tipo === 'carpeta') return 1;
      return 0;
    });
    for (let i = 0; i < nodos.length; i++) {
      if (nodos[i].tipo === 'carpeta') {
        ordenarNivel(nodos[i].contenido);
      }
    }
  }

  ordenarNivel(raiz);
  return raiz;
}




//Esta funcion la usamos para mostrar las carpetas y lo que contiene dentro,cada archivo/carpeta tiene un nivel, cada nivel se le aumenta una sangria
function FilaArchivo({ item, nivel, idProyecto }) {
  const [abierto, setAbierto] = useState(nivel === 0); //las carpetas del nivel raiz arrancan abiertas, el resto cerradas
  const navigate = useNavigate();

  const paddingLeft = 1 + nivel * 1.2; //Calculamos el margen para dar ese efecto de cascada


  //Esta funcion se ejecuta cuando el usuario hace click en el archivo/carpeta, si es del tipo "Archivo", no hace nada, si es del tipo carpeta, cambia el usestate a false
  function handleClick() {
    if(item.tipo == 'archivo'){
      navigate(`/proyectos/${idProyecto}/archivo/${item.id}`);
    }

    if (item.tipo === 'carpeta') {
      if (abierto) {
        setAbierto(false);
      } else {
        setAbierto(true);
      }
    }
  }


  //Este es el nucleo de la funcion, usamos recursion. CReamos un array hijos y evaluamos con un if tres condiciones, si se dan las tres condiciones el bucle for recorre cada uno de los elementos que tiene esa carpeta.
  //Finalmente por cada elemento interno, la funcion se llama a si misma
  const hijos = [];
  if (item.tipo === 'carpeta' && abierto && item.contenido) {
    for (let i = 0; i < item.contenido.length; i++) {
      hijos.push(
        <FilaArchivo key={item.contenido[i].nombre} item={item.contenido[i]} nivel={nivel + 1} idProyecto={idProyecto} />
      );
    }
  }

  //Aqui renderizamos en el dom todo
  return (
    <div>
      <div
        className={styles.fila}
        style={{ paddingLeft: paddingLeft + 'rem' }}
        onClick={handleClick}
      >
        <span className={styles.filaIcono}>
          {item.tipo === 'carpeta' ? <IconoCarpeta /> : <IconoArchivo />}
        </span>
        <span className={styles.filaNombre}>{item.nombre}</span>
      </div>
      {hijos} {/* Si la carpeta esta cerrada el array hijos esta vacio, si no esta cerrada, este array contiene los <Links> de cada elemento que habia en la carpeta */}
    </div>
  );
}

//################################################################################################

//FUNCION PRINCIPAL
export default function ProjectPanel() {
  const { id } = useParams(); //leemos el :id de la URL para saber el id del proyecto estamos renderizando

  const [proyecto, setProyecto] = useState(null);
  const [arbol, setArbol] = useState([]);
  const [cargando, setCargando] = useState(true);


  useEffect(function() {
    async function cargarDatos() {
      try {
        const [respProyecto, respArchivos] = await Promise.all([
          apiClient.get('/proyectos/' + id), //Obtiene info del proyecto
          apiClient.get('/archivos/proyecto/' + id) //Obtiene una lista de cada archivo perteneciente al proyecto, cada archivo es un diccionario en la lista [{ id, nombre, tipo, rutaRelativa }, ...]
        ]);

        setProyecto(respProyecto.data);
        setArbol(construirArbol(respArchivos.data)); // Pasamos la lista plana a la funcion contruirArbol y obtenemos un arbol jerarquico por carpetas usando la rutaRelativa de cada archivo

      } catch (err) {
        console.error('Error al cargar el proyecto', err);
      } finally {
        setCargando(false);
      }
    }
    cargarDatos();
  }, [id]); // Se vuelve a ejecutar cuando el usuario navega a otro proyecto


  if (cargando) {
    return <p className={styles.noEncontrado}>Cargando...</p>;
  }

  if (!proyecto) {
    return <p className={styles.noEncontrado}>Proyecto no encontrado.</p>;
  }


  const filas = [];
  for (let i = 0; i < arbol.length; i++) {
    filas.push(
      <FilaArchivo key={arbol[i].nombre} idProyecto={id} item={arbol[i]} nivel={0} />
    );
  }


  return (
    <div className={styles.panel}>
      <h2 className={styles.titulo}>{proyecto.nombreproyecto}</h2>

      <div className={styles.explorador}>
        <div className={styles.exploradorHeader}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          Archivos
        </div>
        <div className={styles.exploradorCuerpo}>
          {filas}
        </div>
      </div>

      {proyecto.descripcion && (
        <div className={styles.descripcionBloque}>
          <span className={styles.descripcionLabel}>Descripción</span>
          <p className={styles.descripcionValor}>{proyecto.descripcion}</p>
        </div>
      )}
    </div>
  );
}
