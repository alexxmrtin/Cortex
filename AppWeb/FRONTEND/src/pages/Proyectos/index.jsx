import { useState, useEffect } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import styles from '../../styles/Projects.module.css';
import perfilNoDefinido from '../../assets/perfilNoDefinido.jpg';
import apiClient from '../../services/api';


export default function Projects() {
  const [proyectos, setProyectos] = useState([]);
  const [usuario, setUsuario] = useState(null);

  const { id } = useParams(); //useParams lee el :id de la URL actual y la guarda en la variable, lo usamos para construir los links dinamicos de cada proyecto y asignar un estilo diferente al proyecto seleccionado

  
  useEffect(function() {
    async function cargarProyectos() {
      const respuesta = await apiClient.get('/proyectos/');
      setProyectos(respuesta.data); //respuesta.data es un array de diccionarios, cada diccionario es un proyecto
    }
    cargarProyectos();
  }, [id]); // Se vuelve a ejecutar cuando cambia el id, asi si acabas de crear un proyecto y navegas a el, la lista se recarga


  useEffect(function() {
    async function cargarUsuario() {
      const respuesta = await apiClient.get('/usuarios/me');
      setUsuario(respuesta.data);
    }
    cargarUsuario();
  }, []); // Solo se ejecuta al montar el componente, el usuario no cambia mientras navega entre proyectos


  //Este bloque construye los links de los proyectos en la sidebar, cada usuario tendra diferentes proyectos
  const itemsProyectos = [];
  for (let i = 0; i < proyectos.length; i++) {
    let itemClass = styles.sidebarItem;
    if (String(proyectos[i].id) === id) {
      itemClass = itemClass + ' ' + styles.sidebarItemActive;
    }
    itemsProyectos.push(
      <Link key={proyectos[i].id} to={'/proyectos/' + proyectos[i].id} className={itemClass}>
        {proyectos[i].nombreproyecto}
      </Link>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        
        {/*Funcionalidad a desarrollar, abrir un panel a la derecha de la pagina con una interfaz donde poder preguntarle a la IA cosas sobre el proyecto, la IA debe tener el contexto del proyecto */}
        <Link to="" className={styles.sidebarItem}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>
            </svg>
            Usar IA (En desarrollo...)
          </Link>
          
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
        
        {/*<Outlet /> es un componente de React Router que actúa como un hueco — un espacio reservado donde se renderiza la ruta hija activa. Cuando la url coincide con una ruta hija definida en APP.jsx, carga la pagina definida en esa ruta hija, que en este caso es ProjectPanel */}
        <Outlet />
      </main>
    </div>
  );
}
