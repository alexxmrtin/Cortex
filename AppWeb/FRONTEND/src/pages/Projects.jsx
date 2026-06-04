import { useState, useEffect } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import styles from '../styles/Projects.module.css';
import perfilNoDefinido from '../assets/perfilNoDefinido.jpg';

export default function Projects() {
  const [proyectos, setProyectos] = useState([]);
  const { id } = useParams(); //useParams lee el :id de la URL actual y la guarda en la variable, lo usamos para construir los links dinamicos de cada proyecto y asignar un estilo diferente al proyecto seleccionado

  //Rellenamos el useState creado anteriormente
  useEffect(function() {
    // TODO: reemplazar con llamada real al backend
    // fetch('/api/proyectos', { headers: { Authorization: 'Bearer ' + token } })
    //   .then(function(res) { return res.json(); })
    //   .then(function(data) { setProyectos(data); });

    // Datos de prueba hasta tener el backend
    const datosDePrueba = [
      { id: 1, nombre: 'Proyecto 1' },
      { id: 2, nombre: 'Proyecto 2' },
      { id: 3, nombre: 'Proyecto 3' },
    ];
    setProyectos(datosDePrueba);
  }, []);

  //Este bloque construye los links de los proyectos en la sidebar, cada usuario tendra diferentes proyectos
  const itemsProyectos = [];
  for (let i = 0; i < proyectos.length; i++) {
    let itemClass = styles.sidebarItem;
    if (String(proyectos[i].id) === id) {
      itemClass = itemClass + ' ' + styles.sidebarItemActive;
    }
    itemsProyectos.push(
      <Link key={proyectos[i].id} to={'/proyectos/' + proyectos[i].id} className={itemClass}>
        {proyectos[i].nombre}
      </Link>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        
        {/*Funcionalidad a desarrollar, abrir un panel a la derecha de la pagina con una interfaz donde poder preguntarle a la IA cosas sobre el proyecto, la IA debe tener el contexto del proyecto */}
        <Link to="/ia" className={styles.sidebarItem}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2"/>
              <path d="M12 11V7"/>
              <circle cx="12" cy="5" r="2"/>
              <path d="M8 11V9a4 4 0 0 1 8 0v2"/>
              <line x1="8" y1="15" x2="8" y2="15" strokeWidth="3" strokeLinecap="round"/>
              <line x1="12" y1="15" x2="12" y2="15" strokeWidth="3" strokeLinecap="round"/>
              <line x1="16" y1="15" x2="16" y2="15" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            Usar IA
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

          <p className={styles.sidebarSection}>Cuenta</p>
          <Link to="/ajustes" className={styles.sidebarItem}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Ajustes
          </Link>
        </nav>

        <Link to="/perfil" className={styles.sidebarUser}>
          <img src={perfilNoDefinido} alt="perfil" className={styles.sidebarAvatar} />
          <div className={styles.sidebarUserInfo}>
            <span className={styles.sidebarUserName}>Usuario</span>
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
