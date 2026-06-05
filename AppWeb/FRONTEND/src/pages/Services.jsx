import { useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import styles from '../styles/Services.module.css';
import perfilNoDefinido from '../assets/perfilNoDefinido.jpg';

//Estos servicios deben ser dinamicos
const SERVICIOS_PRUEBA = [
  { id: 1, nombre: 'Servidor Web Cortex', tipo: 'Nginx', activo: true },
  { id: 2, nombre: 'Base de Datos Cortex', tipo: 'PostgreSQL', activo: false },
  { id: 3, nombre: 'Caché', tipo: 'Redis', activo: true },
  { id: 4, nombre: 'Autenticación', tipo: 'OAuth2', activo: false },
];

export default function Services() {
  const [servicios] = useState(SERVICIOS_PRUEBA);
  const { id } = useParams();

  const itemsServicios = servicios.map(function (servicio) {
    let claseIndicador;
    if (servicio.activo) {
      claseIndicador = styles.indicadorActivo;
    } else {
      claseIndicador = styles.indicadorInactivo;
    }

    let itemClass = styles.sidebarItem;
    if (String(servicio.id) === id) {
      itemClass = itemClass + ' ' + styles.sidebarItemActive;
    }

    return (
      <Link key={servicio.id} to={'/servicios/' + servicio.id} className={itemClass}>
        <div className={styles.servicioTexto}>
          <span className={styles.servicioNombre}>{servicio.nombre}</span>
          <span className={styles.servicioTipo}>{servicio.tipo}</span>
        </div>
        <span className={claseIndicador}/>
      </Link>
    );
  });

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Link to="" className={styles.sidebarItem}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>
          </svg>
          Usar IA
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

        <Link to="/perfil" className={styles.sidebarUser}>
          <img src={perfilNoDefinido} alt="perfil" className={styles.sidebarAvatar} />
          <div className={styles.sidebarUserInfo}>
            <span className={styles.sidebarUserName}>Usuario</span>
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
