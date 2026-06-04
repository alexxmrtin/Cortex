import { useState } from 'react';
import { useParams } from 'react-router-dom';
import styles from '../styles/ProjectPanel.module.css';

// TODO: reemplazar con datos reales del backend (GET /api/proyectos/:id)
const datosDePrueba = {
  1: {
    nombre: 'Proyecto 1',
    archivos: [
      { nombre: 'src', tipo: 'carpeta', contenido: [
        { nombre: 'index.js', tipo: 'archivo' },
        { nombre: 'App.js', tipo: 'archivo' },
      ]},
      { nombre: 'public', tipo: 'carpeta', contenido: [
        { nombre: 'index.html', tipo: 'archivo' },
      ]},
      { nombre: 'README.md', tipo: 'archivo' },
      { nombre: 'package.json', tipo: 'archivo' },
    ],
    descripcion: '',
  },
  2: {
    nombre: 'Proyecto 2',
    archivos: [
      { nombre: 'main.py', tipo: 'archivo' },
      { nombre: 'requirements.txt', tipo: 'archivo' },
    ],
    descripcion: '',
  },
  3: {
    nombre: 'Proyecto 3',
    archivos: [
      { nombre: 'docs', tipo: 'carpeta', contenido: [
        { nombre: 'guia.md', tipo: 'archivo' },
      ]},
      { nombre: 'index.html', tipo: 'archivo' },
    ],
    descripcion: '',
  },
};

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

//Esta funcion es la mas compleja, la usamos para mostrar las carpetas y lo que contiene dentro,cada archivo/carpeta tiene un nivel, cada nivel se le aumenta una sangria
function FilaArchivo({ item, nivel }) {
  const [abierto, setAbierto] = useState(false); //declaramos el estado del archivo, si esta abierto el archivo o no

  const paddingLeft = 1 + nivel * 1.2; //Calculamos el margen para dar ese efecto de cascada

  //Esta funcion se ejecuta cuando el usuario hace click en el archivo/carpeta, si es del tipo "Archivo", no hace nada, si es del tipo carpeta, cambia el usestate a false
  function handleClick() {
    if(item.tipo == 'archivo'){
      //Pendiente de implementar, quiero que se muestre el archivo, ya sea codigo o texto
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
        <FilaArchivo key={item.contenido[i].nombre} item={item.contenido[i]} nivel={nivel + 1} />
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

export default function ProjectPanel() {
  const { id } = useParams(); //leemos el :id de la URL para saber el id del proyecto estamos renderizando
  const proyecto = datosDePrueba[id]; //Cojemos el proyecto del array usando su id, esto luego cuando crremos la API tiene que ser modificado

  const [descripcion, setDescripcion] = useState('');

  //Esta funcion es muy importante, vamos a tener que escribir en la base de datos usando la API para dejar la descripcion puesta
  function handleDescripcionChange(e) {
    setDescripcion(e.target.value);
  }

  if (!proyecto) {
    return <p className={styles.noEncontrado}>Proyecto no encontrado.</p>;
  }

  const filas = [];
  for (let i = 0; i < proyecto.archivos.length; i++) {
    filas.push(
      <FilaArchivo key={proyecto.archivos[i].nombre} item={proyecto.archivos[i]} nivel={0} />
    );
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.titulo}>{proyecto.nombre}</h2>

      <div className={styles.explorador}>
        <div className={styles.exploradorHeader}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          Archivos
        </div>
        <div className={styles.exploradorCuerpo}>
          {filas}
        </div>
      </div>

      <div className={styles.descripcionBloque}>
        <label className={styles.descripcionLabel} htmlFor="descripcion">Descripción</label>
        <textarea
          id="descripcion"
          className={styles.descripcionTexto}
          placeholder="Escribe una descripción del proyecto..."
          value={descripcion}
          onChange={handleDescripcionChange}
        />
      </div>
    </div>
  );
}
