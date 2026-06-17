import { useState, useEffect } from 'react';
import { Link, Outlet, useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/Services.module.css';
import perfilNoDefinido from '../../assets/perfilNoDefinido.jpg';
import apiClient, { API_BASE_URL } from '../../services/api';


export default function Services() {
  const [servicios, setServicios] = useState([]);
  const [vivosMap, setVivosMap] = useState({}); // { [id]: true | false }, indica si cada servicio responde al ping
  const [usuario, setUsuario] = useState(null);
  
  const { id } = useParams();
  const navigate = useNavigate();

  //Llamada a la API para obtener los servicios de la db, luego pinga cada uno en paralelo
  useEffect(function() {
    async function cargarServicios() {
      try {
        const respuesta = await apiClient.get('/servicios/');
        setServicios(respuesta.data);

        // Pingamos todos los servicios en paralelo y construimos el mapa { id: true/false }
        const lista = respuesta.data;//obtenemos los servicios
        const promesas = [];

        //Recorremos la lista haciendo ping a cada servicio
        for (let i = 0; i < lista.length; i++) {
          promesas.push(apiClient.get('/servicios/' + lista[i].id + '/ping'));
        }
        const resultados = await Promise.all(promesas); //Esto es algo complejo, el for crea una lista donde cada elemento es una promesa, esta linea espera y recoge cada promesa dentro de la lista


        //Este ultimo bloque crea el objeto vivosMap, cada par clave valor contiene la id del servicio y un true/false dependiendo de si ha respondido o no
        const nuevoMapa = {};
        for (let i = 0; i < lista.length; i++) {
          nuevoMapa[lista[i].id] = resultados[i].data.vivo; //{1:true , 2:false , 3:false...}
        }
        setVivosMap(nuevoMapa);
      } catch (err) {
        console.error('Error al cargar los servicios', err);
      }
    }
    cargarServicios();
  }, [id]); // Se vuelve a ejecutar cuando cambia el id, igual que en Projects.jsx


  //Llamada a la API para obtener el usuario usando el token JWT
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
  }, []);


  // Navega a la pagina de actualizar el servicio. stopPropagation evita que el click llegue al div padre y abra el panel.
  function editarServicio(e, idServicio) {
    e.stopPropagation(); //Esto es necesario porque estamos poniendo el boton de editar encima del boton que lleva al proyecto
    navigate('/servicios/' + idServicio + '/actualizar');
  }

  // Borra el servicio en la BD con el endpoint DELETE y refresca la lista del sidebar
  async function eliminarServicio(e, idServicio) {
    e.stopPropagation(); //Esto es necesario porque estamos poniendo el boton de borrar encima del boton que lleva al proyecto

    // Pedimos confirmacion antes de borrar, porque es una accion irreversible
    const confirmado = window.confirm('¿Seguro que quieres borrar este servicio? Esta acción no se puede deshacer.');
    if (!confirmado) {
      return;
    }

    try {
      await apiClient.delete('/servicios/' + idServicio);

      // Si estabas viendo el servicio que se acaba de borrar, vuelves a la lista
      if (String(idServicio) === id) {
        navigate('/servicios');
      }

      // Recargamos la lista para que el servicio borrado desaparezca del sidebar
      const respuesta = await apiClient.get('/servicios/');
      setServicios(respuesta.data);
    } catch (err) {
      console.error('Error al borrar el servicio', err);
    }
  }


  //Bloque de codigo que contruye el sidebar con los servicios obtenidos de la API, se ejecuta este bloque cada vez que se renderiza la pagina, es decir, cuadno cambia un estado o una prop
  const itemsServicios = [];
  
  for (let i = 0; i < servicios.length; i++) {
    let claseIndicador;

    // vivosMap[id] puede ser undefined (todavia comprobando), true (responde) o false (no responde)
    if (vivosMap[servicios[i].id] === true) {
      claseIndicador = styles.indicadorActivo;
    } else if (vivosMap[servicios[i].id] === false) {
      claseIndicador = styles.indicadorInactivo;
    } else {
      claseIndicador = styles.indicadorComprobando; // mientras llegan los pings
    }

    let itemClass = styles.sidebarItem;
    if (String(servicios[i].id) === id) {
      itemClass = itemClass + ' ' + styles.sidebarItemActive;
    }

    // Guardamos el id en una variable local para usarlo dentro de los onClick de los iconos
    const idServicio = servicios[i].id;

    itemsServicios.push(
      <div key={idServicio} className={itemClass} onClick={function () { navigate('/servicios/' + idServicio); }}>
        <div className={styles.servicioTexto}>
          <span className={styles.servicioNombre}>{servicios[i].nombre}</span>
          <span className={styles.servicioTipo}>{servicios[i].tipo}</span>
        </div>

        {/* Iconos que aparecen al pasar el raton: editar y borrar */}
        <div className={styles.servicioAcciones}>
          <button
            className={styles.servicioAccion}
            onClick={function (e) { editarServicio(e, idServicio); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
          </button>
          <button
            className={styles.servicioAccion + ' ' + styles.servicioAccionBorrar}
            onClick={function (e) { eliminarServicio(e, idServicio); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>

        <span className={claseIndicador}/>
      </div>
    );
  }


  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Link to="/servicios/agregarServicio" className={styles.sidebarItem}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar Servicio
          </Link>

        <nav className={styles.sidebarNav}>
          <p className={styles.sidebarSection}>Servicios</p>
          {itemsServicios}
        </nav>

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
        <Outlet />
      </main>
    </div>
  );
}
