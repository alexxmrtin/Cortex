import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/AgregarProyecto.module.css';
import buscadorStyles from '../../styles/BuscadorProyecto.module.css';
import apiClient from '../../services/api';

export default function AgregarServicio() {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [host, setHost] = useState('');
  const [puerto, setPuerto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  //Estos son estados que controlan el buscador de proyectos en el formulario
  const [proyectos, setProyectos] = useState([]); //Lista de proyectos del usuario cargada desde la API
  const [busqueda, setBusqueda] = useState(''); //Contiene el texto qeu escribe el usuario en el input
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);//Contiene el proyecto elegido
  const [desplegableAbierto, setDesplegableAbierto] = useState(false);//Controla si se muestran las opciones
  const buscadorRef = useRef(null);

  //Llamada a la API para obtener los proyectos vinculados al usuario, se usa el token JWT del usuario
  useEffect(function() {
    async function cargarProyectos() {
      try {
        const respuesta = await apiClient.get('/proyectos/');
        setProyectos(respuesta.data);
      } catch (err) {
        console.error('Error al cargar los proyectos', err);
      }
    }
    cargarProyectos();
  }, []);


  // Cierra el desplegable si el usuario hace clic fuera
  useEffect(function () {
    //Listener que ejecuta handleClickFuera cada vez que el usuario hace click en cualquier parte de la pagina
    function handleClickFuera(e) {
      //e.target es el elemento exacto donde clicka, este bloque "!buscadorRef.current.contains(e.target)" verifica si e.target esta dentro del div del buscador
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) {
        setDesplegableAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFuera);

    //Este return ejecuta automaticamente handleClickFuera cuando el componente desaparece de la pantalla, importante para que no ocurra un memory leak
    return function () {
      document.removeEventListener('mousedown', handleClickFuera);
    };
  }, []);


  // Filtra los proyectos segun lo que escribe el usuario
  const proyectosFiltrados = [];
  for (let i = 0; i < proyectos.length; i++) {
    if (proyectos[i].nombreproyecto.toLowerCase().includes(busqueda.toLowerCase())) {
      proyectosFiltrados.push(proyectos[i]);
    }
  }

  //Esta funcion se ejecuta cada vez que pulsas una tecla en el buscador de proyecto
  function handleBusquedaChange(e) {
    setBusqueda(e.target.value);
    setProyectoSeleccionado(null);
    setDesplegableAbierto(true);
  }

  //Esta funcion se ejecuta cuando seleccionas un proyecto en el desplegable
  function seleccionarProyecto(proyecto) {
    setProyectoSeleccionado(proyecto);
    setBusqueda(proyecto.nombreproyecto);
    setDesplegableAbierto(false);
  }

  //Cuando seleccionas un proyecto, se queda en el textarea y aparece un boton "X", si presionas el boton se ejecuta esta funcion
  function limpiarProyecto() {
    setProyectoSeleccionado(null);
    setBusqueda('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setCargando(true);
    setError('');

    try {
      const respuesta = await apiClient.post('/servicios/', {
        nombre: nombre,
        tipo: tipo,
        host: host,
        puerto: Number(puerto),
        proyectoAsociado: proyectoSeleccionado ? proyectoSeleccionado.id : null,
        descripcion: descripcion
      });
      navigate('/servicios/' + respuesta.data.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear el servicio');
      setCargando(false);
    }
  }

  //Funcion que maneja el boton cancelar, vuelves a /servicios
  function handleCancelar() {
    navigate('/servicios');
  }


  // Construye el desplegable con las opciones de proyectos
  const opcionesProyecto = [];
  for (let i = 0; i < proyectosFiltrados.length; i++) {
    const p = proyectosFiltrados[i];
    opcionesProyecto.push(
      <button
        key={p.id}
        type="button"
        className={buscadorStyles.opcion}
        onClick={function () { seleccionarProyecto(p); }}
      >
        {p.nombreproyecto}
      </button>
    );
  }


  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <div className={styles.cardHeader}>
          <h1 className={styles.title}>Nuevo Servicio</h1>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="nombre">Nombre del servicio</label>
            <input
              id="nombre"
              type="text"
              className={styles.input}
              placeholder="Mi servicio"
              value={nombre}
              onChange={function (e) { setNombre(e.target.value); }}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="tipo">Tipo de servidor</label>
            <input
              id="tipo"
              type="text"
              className={styles.input}
              placeholder="Nginx, PostgreSQL, Redis..."
              value={tipo}
              onChange={function (e) { setTipo(e.target.value); }}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="host">Host</label>
            <input
              id="host"
              type="text"
              className={styles.input}
              placeholder="192.168.1.10"
              value={host}
              onChange={function (e) { setHost(e.target.value); }}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="puerto">Puerto</label>
            <input
              id="puerto"
              type="number"
              className={styles.input}
              placeholder="80"
              value={puerto}
              onChange={function (e) { setPuerto(e.target.value); }}
              required
            />
          </div>

          {/*Bloque de buscador de proyecto */}
          <div className={styles.field}>
            <label className={styles.label}>Proyecto asociado</label>
            <div className={buscadorStyles.contenedor} ref={buscadorRef}>
              <div className={buscadorStyles.inputWrapper}>
                <input
                  type="text"
                  className={buscadorStyles.input}
                  placeholder="Buscar proyecto..."
                  value={busqueda} //Cada tecla actualiza el estado de busqueda, lo que aparece en el input
                  onChange={handleBusquedaChange} //Cada vez que cambia el input, se llamada a la funcion handleBusquedaChange
                  onFocus={function () { setDesplegableAbierto(true); }}
                />
                {proyectoSeleccionado && (
                  <button type="button" className={buscadorStyles.limpiar} onClick={limpiarProyecto}>✕</button>
                )}
              </div>

              {/*Esto es un if, se va a crear el div con las opciones si se cumplen la condicion de desplegableAbierto y busqueda.length >0 */}
              {desplegableAbierto && busqueda.length > 0 && (
                <div className={buscadorStyles.desplegable}>

                  {opcionesProyecto.length > 0 ? opcionesProyecto : (
                    <span className={buscadorStyles.sinResultados}>Sin resultados</span>
                  )} {/* Esto es otro if, si opcionesProyecto no esta vacio, se muestra en el dom, si lo esta muestra el span */}

                </div>
              )}
            </div>
          </div>
          {/*Fin del bloque de buscador de proyecto */}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="descripcion">Descripción</label>
            <textarea
              id="descripcion"
              className={styles.input}
              placeholder="Describe brevemente el servicio..."
              value={descripcion}
              onChange={function (e) { setDescripcion(e.target.value); }}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.button} disabled={cargando}>
            {cargando ? 'Creando...' : 'Crear servicio'}
          </button>

          <button type="button" className={styles.buttonSecundario} onClick={handleCancelar}>
            Cancelar
          </button>

        </form>
      </div>
    </div>
  );
}
