import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/Home.module.css';
import perfilNoDefinido from '../assets/perfilNoDefinido.jpg';
import apiClient from '../services/api';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function Calendar() {
  //Guardamos info con usestate de la fecha actual
  const today = new Date();
  const [current, setCurrent] = useState({ month: today.getMonth(), year: today.getFullYear() });

  const firstDay = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate(); //Utilizamos un truco que consiste en obtener los dias del mes usando como dia el 0 y asi obteniendo el ultimo numero del mes que da el total de dias

  //Funcion para obtener mes anterior
  function prev() {
    setCurrent(function(c) {
      let m, y;
      if (c.month === 0) {
        m = 11;
        y = c.year - 1;
      } else {
        m = c.month - 1;
        y = c.year;
      }
      return { month: m, year: y };
    });
  }

  //Funcion para obtener el mes siguiente
  function next() {
    setCurrent(function(c) {
      let m, y;
      if (c.month === 11) {
        m = 0;
        y = c.year + 1;
      } else {
        m = c.month + 1;
        y = c.year;
      }
      return { month: m, year: y };
    });
  }

  // Construimos el array de celdas del calendario
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Construimos los elementos de nombres de dia
  const dayNames = [];
  for (let i = 0; i < DAYS.length; i++) {
    dayNames.push(
      <div key={DAYS[i]} className={styles.calendarDayName}>
        {DAYS[i]}
      </div>
    );
  }

  // Construimos las celdas de los dias
  const dayCells = [];
  for (let i = 0; i < cells.length; i++) {
    const day = cells[i];

    let className = styles.calendarDay;

    if (day === today.getDate() && current.month === today.getMonth() && current.year === today.getFullYear()) {
      className = className + ' ' + styles.calendarToday;
    }

    if (day === null) {
      className = className + ' ' + styles.calendarEmpty;
    }

    dayCells.push(
      <div key={i} className={className}>
        <span>{day}</span>
      </div>
    );
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarHeader}>
        <button onClick={prev} className={styles.calendarNav}>&#8249;</button>
        <span className={styles.calendarTitle}>{MONTHS[current.month]} {current.year}</span>
        <button onClick={next} className={styles.calendarNav}>&#8250;</button>
      </div>
      <div className={styles.calendarGrid}>
        {dayNames}
        {dayCells}
      </div>
    </div>
  );
}

function SidebarItem({ to, icon, label, expandable, children }) {
  const [open, setOpen] = useState(false);

  function toggleOpen() {
    if (open) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }

  //bloque donde modifica la apariencia de la flecha dependiendo si esta desplegado o no
  let chevronClass = styles.sidebarChevron;
  if (open) {
    chevronClass = chevronClass + ' ' + styles.sidebarChevronOpen;
  }

  let dropdownClass = styles.sidebarDropdown;
  if (open) {
    dropdownClass = dropdownClass + ' ' + styles.sidebarDropdownOpen;
  }

  let chevronButton = null;
  if (expandable) {
    chevronButton = (
      <button className={chevronClass} onClick={toggleOpen} aria-label="Desplegar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    );
  }

  let dropdown = null;
  if (expandable) {
    dropdown = (
      <div className={dropdownClass}>
        {children}
      </div>
    );
  }

  return (
    <div className={styles.sidebarItemWrapper}>
      <div className={styles.sidebarItemRow}>
        <Link to={to} className={styles.sidebarItem}>
          {icon}
          {label}
        </Link>
        {chevronButton}
      </div>
      {dropdown}
    </div>
  );
}


function getFotoPerfil(fotoPerfil) {
  if (fotoPerfil) return `${import.meta.env.VITE_API_URL}${fotoPerfil}`;
  return perfilNoDefinido;
}


function ListaServiciosActivos(servicios) {
  if (!servicios) return null;

  const activos = [];
  for (let i = 0; i < servicios.length; i++) {
    if (servicios[i].estado === 'activo') {
      activos.push(servicios[i]);
    }
    if (activos.length === 5) break;
  }

  return (
    <ul className={styles.serviciosList}>
      {activos.map(function(s) {
        return (
          <li key={s.id} className={styles.serviciosItem}>
            {s.nombre}
            <span className={styles.puntoActivo}/>
          </li>
        );
      })}
    </ul>
  );
}


export default function Home() {
  const token = localStorage.getItem('authToken');
  
  const [usuario, setUsuario] = useState(null);
  const [servicios, setServicios] = useState(null);
  const [proyectos, setProyectos] = useState(null);

  

  //Usamos useEffect para que cada vez que renderize esta funcion en el dom y se dispara mirando si existe un token
  useEffect(function() {
    if (!token) return;
    
    async function cargarUsuario() {
      const respuesta = await apiClient.get('/usuarios/me');
      setUsuario(respuesta.data);
    }

    async function cargarServicios() {
      const respuesta = await apiClient.get('/servicios/');
      setServicios(respuesta.data);
    }

    async function cargarProyectos() {
      const respuesta = await apiClient.get('/proyectos/');
      setProyectos(respuesta.data);
    }

    cargarUsuario();
    cargarServicios();
    cargarProyectos();
  }, []);


  //VISTA DE USUARIO LOGEADO
  if (token) {
    
    const itemsServicios = [];
    if (servicios) {
      for (let i = 0; i < servicios.length && itemsServicios.length < 3; i++) {
        
        const s = servicios[i];
        let puntoCss;
        
        if (s.estado === 'activo') {
          puntoCss = styles.puntoActivo;
        } else {
          puntoCss = styles.puntoInactivo;
        }
        
        itemsServicios.push(
          <Link key={s.id} to="/servicios" className={styles.sidebarDropdownItem}>
            {s.nombre}
            <span className={puntoCss}/>
          </Link>
        );
      }
    }

    const itemsProyectos = [];
    if (proyectos) {
      for (let i = 0; i < proyectos.length && itemsProyectos.length < 3; i++) {
        itemsProyectos.push(
          <Link key={proyectos[i].id} to="/proyectos" className={styles.sidebarDropdownItem}>
            {proyectos[i].nombre}
          </Link>
        );
      }
    }

    
    return (
      <div>
        <main className={styles.main}>
          <section className={styles.hero}>
            <h1>Bienvenido, {usuario ? usuario.nombreUsuario.split(' ')[0] : ''}</h1> 
            <Link to="/">Cerrar Sesión</Link>
          </section>
          
          <section className={styles.hero2}>
            <h4>Servicios activos</h4>

            {ListaServiciosActivos(servicios)}
          </section>
          
        </main>

        <div className={styles.home}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarLogo}>
              <span className={styles.sidebarLogoIcon}>⬡</span>
              <span className={styles.sidebarLogoText}>Cortex</span>
            </div>

            <nav className={styles.sidebarNav}>
              <p className={styles.sidebarSection}>Principal</p>
              
              <SidebarItem
                to="/proyectos"
                label="Proyectos"
                expandable
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
              >
                {itemsProyectos}
              </SidebarItem>
              
              <SidebarItem
                to="/servicios"
                label="Servicios"
                expandable
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              >
                {itemsServicios}
              </SidebarItem>

              <SidebarItem
                to="/centroIA"
                label="Centro IA"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/></svg>}
              />

              <p className={styles.sidebarSection}>Cuenta</p>
              <Link to="/ajustes" className={styles.sidebarItem}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Ajustes
              </Link>
            </nav>

            <div className={styles.sidebarUser}>
              <img src={getFotoPerfil(usuario?.fotoPerfil)} alt="perfil" className={styles.sidebarAvatar} />
              <div className={styles.sidebarUserInfo}>
                <span className={styles.sidebarUserName}>{usuario?.nombreUsuario}</span>
                <span className={styles.sidebarUserRole}>Miembro</span>
              </div>
            </div>
          </aside>

          <div className={styles.calendary}>
            <Calendar />
          </div>

        </div>

      </div>
    );
  }

  //VISTA DE USUARIO NO LOGEADO
  else {
    return (
      <div>
        <main className={styles.main}>
          <section className={styles.hero}>
            <h1>Bienvenido a Cortex!</h1>
          </section>

          <Link to="/login" className={styles.loginBtn}>Iniciar sesión</Link>
        </main>

        <div className={styles.home}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarLogo}>
              <span className={styles.sidebarLogoIcon}>⬡</span>
              <span className={styles.sidebarLogoText}>Cortex</span>
            </div>

            <nav className={styles.sidebarNav}>
              <p className={styles.sidebarSection}>Principal</p>
              <SidebarItem
                to="/"
                label="Proyectos"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
              />


              <SidebarItem
                to="/"
                label="Servicios"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              />

              <SidebarItem
                to="/"
                label="Centro IA"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/></svg>}
              />

              <p className={styles.sidebarSection}>Cuenta</p>
             
              <Link to="/ajustes" className={styles.sidebarItem}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Ajustes
              </Link>

            </nav>

          </aside>

          <div className={styles.calendary}>
            <Calendar />
          </div>

        </div>

      </div>
    );
  }
}
