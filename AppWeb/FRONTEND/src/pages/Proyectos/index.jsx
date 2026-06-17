import { useState, useEffect } from 'react';
import { Link, Outlet, useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/Projects.module.css';
import perfilNoDefinido from '../../assets/perfilNoDefinido.jpg';
import apiClient, { API_BASE_URL } from '../../services/api';
import PanelConversacionIA from '../../components/PanelConversacionIA';
import SelectorModelo from '../../components/SelectorModelo';


// Titulo centinela con el que identificamos LA conversacion del panel de IA de cada proyecto.
// Combinado con el proyecto_id, nos permite reutilizar siempre la misma conversacion por proyecto.
export const TITULO_PANEL_IA = 'Asistente del proyecto';


export default function Projects() {
  const [proyectos, setProyectos] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [panelAbierto, setPanelAbierto] = useState(false);        // controla si el panel de IA esta abierto
  const [conversacionIaId, setConversacionIaId] = useState(null); // id de la conversacion del panel para este proyecto (null si aun no existe)

  const { id } = useParams(); //useParams lee el :id de la URL actual y la guarda en la variable, lo usamos para construir los links dinamicos de cada proyecto y asignar un estilo diferente al proyecto seleccionado
  const navigate = useNavigate();


  
  useEffect(function() {
    async function cargarProyectos() {
      try {
        const respuesta = await apiClient.get('/proyectos/');
        setProyectos(respuesta.data); //respuesta.data es un array de diccionarios, cada diccionario es un proyecto
      } catch (err) {
        console.error('Error al cargar los proyectos', err);
      }
    }
    cargarProyectos();
  }, [id]); // Se vuelve a ejecutar cuando cambia el id, asi si acabas de crear un proyecto y navegas a el, la lista se recarga


  useEffect(function() {
    async function cargarUsuario() {
      try {
        const respuesta = await apiClient.get('/usuarios/me');
        setUsuario(respuesta.data);
      } catch (err) {
        console.error('Error al cargar el usuario', err);
      }
    }
    cargarUsuario();
  }, []); // Solo se ejecuta al montar el componente, el usuario no cambia mientras navega entre proyectos

  //---------------------------------------------------------------------------------------------------------------

  // Al cambiar de proyecto, buscamos si ya existe la conversacion del panel de IA para ese proyecto.
  // Si existe, guardamos su id para que el panel cargue el historial; si no, queda null y se creara al primer mensaje.
  useEffect(function () {
    if (!id) {
      return;
    }

    async function buscarConversacion() {
      try {
        const respuesta = await apiClient.get('/conversaciones/');

        // Buscamos la conversacion del panel de este proyecto; si no hay, queda en null
        let encontradaId = null;
        for (let i = 0; i < respuesta.data.length; i++) {
          const conv = respuesta.data[i];
          if (conv.proyecto_id === Number(id) && conv.titulo.startsWith(TITULO_PANEL_IA)) {
            encontradaId = conv.id;
            break;
          }
        }
        setConversacionIaId(encontradaId); // setState tras el await: no es sincrono dentro del efecto
      } catch (err) {
        console.error('Error al buscar la conversacion del proyecto', err);
      }
    }
    buscarConversacion();
  }, [id]);


  // Funcion que le pasamos al panel para que cree la conversacion de este proyecto al enviar el primer mensaje.
  // Devuelve el id de la conversacion recien creada (el panel lo necesita de vuelta).
  async function crearConversacionProyecto() {
    const respuesta = await apiClient.post('/conversaciones/', {
      titulo: TITULO_PANEL_IA + ' ' + proyectoNombre,
      proyecto_id: Number(id),
    });
    return respuesta.data.id;
  }

  // Actualiza en el estado local el modelo de IA cuando el usuario lo cambia en el selector.
  // (El guardado en la BD lo hace SelectorModelo por dentro con un PATCH a /usuarios/me.)
  function cambiarModelo(modeloId) {
    setUsuario(function (anterior) {
      return { ...anterior, modeloIA: modeloId };
    });
  }


  // Abre el panel de IA si esta cerrado, y lo cierra si esta abierto
  function alternarPanel() {
    if (panelAbierto) {
      setPanelAbierto(false);
    } else {
      setPanelAbierto(true);
    }
  }

  // Nombre legible del modelo de IA del usuario (para mostrarlo en la cabecera del panel).
  let nombreIA = null;
  if (usuario) {
    if (usuario.modeloIA === 'claude-sonnet-4-6') {
      nombreIA = 'Claude Sonnet 4.6';
    } else if (usuario.modeloIA === 'llama-3.3-70b-versatile') {
      nombreIA = 'Llama 3.3 70B';
    } else if (usuario.modeloIA === 'gemini-2.0-flash') {
      nombreIA = 'Gemini 2.0 Flash';
    }
  }
  //-----------------------------------------------------------------------------------------------------------

  // Navega a la pagina de actualizar el proyecto. stopPropagation evita que el click abra el panel del proyecto.
  function editarProyecto(e, idProyecto) {
    e.stopPropagation();
    navigate('/proyectos/' + idProyecto + '/actualizar');
  }

  // Borra el proyecto con el endpoint DELETE (tras confirmar) y refresca la lista del sidebar
  async function eliminarProyecto(e, idProyecto) {
    e.stopPropagation();

    // Pedimos confirmacion antes de borrar, porque es una accion irreversible
    const confirmado = window.confirm('¿Seguro que quieres borrar este proyecto? Esta acción no se puede deshacer.');
    if (!confirmado) {
      return;
    }

    try {
      await apiClient.delete('/proyectos/' + idProyecto);

      // Si estabas viendo el proyecto que se acaba de borrar, vuelves a la lista
      if (String(idProyecto) === id) {
        navigate('/proyectos');
      }

      // Recargamos la lista para que el proyecto borrado desaparezca del sidebar
      const respuesta = await apiClient.get('/proyectos/');
      setProyectos(respuesta.data);
    } catch (err) {
      console.error('Error al borrar el proyecto', err);
    }
  }


  //Este bloque construye los links de los proyectos en la sidebar, cada usuario tendra diferentes proyectos
  const itemsProyectos = [];
  for (let i = 0; i < proyectos.length; i++) {
    let itemClass = styles.sidebarItem;
    if (String(proyectos[i].id) === id) {
      itemClass = itemClass + ' ' + styles.sidebarItemActive;
    }

    // Guardamos el id en una variable local para usarlo dentro de los onClick de los iconos
    const idProyecto = proyectos[i].id;

    itemsProyectos.push(
      <div key={idProyecto} className={itemClass} onClick={function () { navigate('/proyectos/' + idProyecto); }}>
        <span className={styles.proyectoNombre}>{proyectos[i].nombreproyecto}</span>

        {/* Iconos que aparecen al pasar el raton: editar y borrar */}
        <div className={styles.proyectoAcciones}>
          
          <button
            className={styles.proyectoAccion}
            onClick={function (e) { editarProyecto(e, idProyecto); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
          </button>

          <button
            className={styles.proyectoAccion + ' ' + styles.proyectoAccionBorrar}
            onClick={function (e) { eliminarProyecto(e, idProyecto); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
          
        </div>
      </div>
    );
  }


  // Nombre del proyecto activo
  let proyectoNombre = null;
  for (let i = 0; i < proyectos.length; i++) {
    if (String(proyectos[i].id) === id) {
      proyectoNombre = proyectos[i].nombreproyecto;
      break;
    }
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        
        {/* Boton que abre/cierra el panel de IA del proyecto seleccionado */}
        <button
          type="button"
          className={styles.sidebarItem}
          onClick={alternarPanel}
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>
            </svg>
            Usar IA
          </button>

          {/* Aviso si el usuario abre el panel sin tener ningun proyecto seleccionado */}
          {panelAbierto && !id && (
            <p className={styles.avisoProyecto}>Selecciona un proyecto primero</p>
          )}

          <Link to="/proyectos/agregarProyecto" className={styles.sidebarItem}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar Proyecto
          </Link>

        <nav className={styles.sidebarNav}>
          <p className={styles.sidebarSection}>Proyectos</p>
          {itemsProyectos}
        </nav>

        {/* Selector del modelo de IA que respondera en el panel */}
        <div className={styles.sidebarModelo}>
          <SelectorModelo modeloActual={usuario && usuario.modeloIA} onCambiar={cambiarModelo} />
        </div>
        
        <Link to="/ajustes" className={styles.sidebarUser}>
          <img
            src={usuario && usuario.fotoPerfil ? API_BASE_URL + usuario.fotoPerfil : perfilNoDefinido}
            alt="perfil"
            className={styles.sidebarAvatar}
          />
          <div className={styles.sidebarUserInfo}>
            <span className={styles.sidebarUserName}>{usuario ? usuario.nombreUsuario : '...'}</span>
            <span className={styles.sidebarUserRole}>Miembro</span>
          </div>
        </Link>
      </aside>

      <main className={styles.content}>

        {/*<Outlet /> es un componente de React Router que actúa como un hueco — un espacio reservado donde se renderiza la ruta hija activa. Cuando la url coincide con una ruta hija definida en APP.jsx, carga la pagina definida en esa ruta hija, que en este caso es ProjectPanel */}
        <Outlet />
      </main>

      {/* Panel de IA: solo se muestra si esta abierto y hay un proyecto seleccionado.
          Le pasamos la conversacion encontrada (o null) y la funcion para crearla al primer mensaje. */}
      {panelAbierto && id && (
        <aside className={styles.panelIA}>
          <div className={styles.panelIAHeader}>
            <span className={styles.panelIATitulo}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>
              </svg>
              Asistente IA - {nombreIA}
            </span>
            <button type="button" className={styles.panelIACerrar} onClick={function () { setPanelAbierto(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* key={id} es una prop especial de React: cuando cambia, React DESTRUYE este componente
              y monta uno nuevo desde cero (con su estado reiniciado). Como id es el id del proyecto,
              al cambiar de proyecto el panel se reinicia limpio en vez de arrastrar los mensajes del
              proyecto anterior. Es la forma recomendada de "resetear" un componente al cambiar una prop,
              sin tener que limpiar mensajes/idActual a mano con un useEffect. */}
          <PanelConversacionIA
            key={id}
            conversacionId={conversacionIaId}
            crearConversacion={crearConversacionProyecto}
            onConversacionCreada={setConversacionIaId}
            placeholder='Pregunta sobre el proyecto...'
          />
        </aside>
      )}
    </div>
  );
}
