import { useState, useEffect } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import styles from '../styles/Services.module.css';
import perfilNoDefinido from '../assets/perfilNoDefinido.jpg';
import apiClient from '../services/api';


export default function Services() {
  const [servicios, setServicios] = useState([]);
  const [vivosMap, setVivosMap] = useState({}); // { [id]: true | false }, indica si cada servicio responde al ping
  const [usuario, setUsuario] = useState(null);
  
  const { id } = useParams();

  //Llamada a la API para obtener los servicios de la db, luego pinga cada uno en paralelo
  useEffect(function() {
    async function cargarServicios() {
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
    }
    cargarServicios();
  }, [id]); // Se vuelve a ejecutar cuando cambia el id, igual que en Projects.jsx


  //Llamada a la API para obtener el usuario usando el token JWT
  useEffect(function() {
    async function cargarUsuario() {
      const respuesta = await apiClient.get('/usuarios/me');
      setUsuario(respuesta.data);
    }
    cargarUsuario();
  }, []);


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

    itemsServicios.push(
      <Link key={servicios[i].id} to={'/servicios/' + servicios[i].id} className={itemClass}>
        <div className={styles.servicioTexto}>
          <span className={styles.servicioNombre}>{servicios[i].nombre}</span>
          <span className={styles.servicioTipo}>{servicios[i].tipo}</span>
        </div>
        <span className={claseIndicador}/>
      </Link>
    );
  }


  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Link to="" className={styles.sidebarItem}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>
          </svg>
          Usar IA (En desarrollo...)
        </Link>

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
            src={usuario && usuario.fotoPerfil ? import.meta.env.VITE_API_URL + usuario.fotoPerfil : perfilNoDefinido}
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
