import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useMatch } from 'react-router-dom';
import styles from '../../styles/CentroIA.module.css';
import perfilNoDefinido from '../../assets/perfilNoDefinido.jpg';
import apiClient from '../../services/api';


// Convierte una fecha ISO a "Hoy", "Ayer" o "3 jun", fechaISO es la fecha que viene de la API con formato string ISO 8601,"2026-06-12T10:30:45.123456"
function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO); //new Date("2026-06-12T10:30:45.123456") crea un objeto con toda la información de la fecha almacenada internamente como un número, con esto podemos llamar a metodos como .getMonth() o .getDay()
  const hoy = new Date(); //Fecha y hora actuales

  const ayer = new Date(); //Fecha de ayer
  ayer.setDate(hoy.getDate() - 1);

  if (fecha.toDateString() === hoy.toDateString()) {
    return 'Hoy';
  }
  if (fecha.toDateString() === ayer.toDateString()){
    return 'Ayer';
  }

  return fecha.getDate() + ' ' + fecha.toLocaleString('es', { month: 'short' }); //Si no se cumplen los otros dos condicionales devuelvela fecha usando el numero del dia y el mes
}


//FUNCION PRINCIPAL
export default function CentroIA() {
  const [usuario, setUsuario] = useState(null);
  const [conversaciones, setConversaciones] = useState([]);
  const navigate = useNavigate();

  //Como el id de la url esta montado en la pagina hija, tenemos que usar esta tecnica para obtener el id en la pagina padre
  const match = useMatch('/centroIA/conversacion/:id'); //useMatch compara la url actual con la url que le das
  const conversacionActivaId = match?.params?.id;

  useEffect(function () {
    async function cargarUsuario() {
      const respuesta = await apiClient.get('/usuarios/me');
      setUsuario(respuesta.data);
    }
    cargarUsuario();
  }, []);

  // Se recarga cada vez que cambia la conversación activa, así aparece en el sidebar justo después de crear una nueva
  useEffect(function () {
    async function cargarConversaciones() {
      const respuesta = await apiClient.get('/conversaciones/');
      setConversaciones(respuesta.data);
    }
    cargarConversaciones();
  }, [conversacionActivaId]);

  //Cuando haces click en Nueva conversacion de la sidebar, te lleva al EmptyStateIA
  function nuevaConversacion() {
    navigate('/centroIA');
  }

  //Cuando haces click en una conversacion de la sidebar, te lleva a ConversacionIA
  function abrirConversacion(conv) {
    navigate('/centroIA/conversacion/' + conv.id);
  }

  // Borra la conversación de la BD y recarga la lista del sidebar.
  // Si se borra la conversación activa, vuelve al EmptyState.
  async function borrarConversacion(e, convId) {
    e.stopPropagation(); // evita que el click llegue al div padre y navegue a la conversacion
    await apiClient.delete('/conversaciones/' + convId);
    if (String(convId) === conversacionActivaId) {
      navigate('/centroIA');
    }
    const respuesta = await apiClient.get('/conversaciones/');
    setConversaciones(respuesta.data);
  }

  // Usamos div en lugar de button porque necesitamos meter un button (papelera) dentro,
  // y HTML no permite anidar buttons
  const itemsConversaciones = conversaciones.map(function (conv) {
    let itemClass = styles.sidebarItem;
    if (String(conv.id) === conversacionActivaId) {
      itemClass = itemClass + ' ' + styles.sidebarItemActive;
    }

    return (
      <div key={conv.id} className={itemClass} onClick={function () { abrirConversacion(conv); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span className={styles.sidebarItemText}>
          <span>{conv.titulo}</span>
          <span className={styles.sidebarItemFecha}>{formatearFecha(conv.fechaCreacion)}</span>
        </span>
        <button className={styles.sidebarItemBorrar} onClick={function (e) { borrarConversacion(e, conv.id); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    );
  });


  //Renderizado
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>

        <button className={styles.sidebarItem} onClick={nuevaConversacion}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva conversación
        </button>

        <Link to="/proyectos" className={styles.sidebarItem}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Ir a Proyectos
        </Link>

        <nav className={styles.sidebarNav}>
          <p className={styles.sidebarSection}>Conversaciones</p>
          {itemsConversaciones}
        </nav>

        <div className={styles.sidebarModel}>
          <div className={styles.sidebarModelBadge}>
            <span className={styles.sidebarModelDot} />
            <div className={styles.sidebarModelTexto}>
              <span className={styles.sidebarModelLabel}>Modelo</span>
              <span className={styles.sidebarModelNombre}>Gemini 1.5 Flash</span>
            </div>
          </div>
        </div>

        <Link to="/ajustes" className={styles.sidebarUser}>
          <img
            src={usuario?.fotoPerfil ? `${import.meta.env.VITE_API_URL}${usuario.fotoPerfil}` : perfilNoDefinido}
            alt="perfil"
            className={styles.sidebarAvatar}
          />
          <div className={styles.sidebarUserInfo}>
            <span className={styles.sidebarUserName}>{usuario?.nombreUsuario ?? '...'}</span>
            <span className={styles.sidebarUserRole}>Miembro</span>
          </div>
        </Link>
      </aside>

      <main className={styles.content}>
        <Outlet /> {/* Por default carga siempre la pagina EmptyStateIA */}
      </main>
    </div>
  );
}
