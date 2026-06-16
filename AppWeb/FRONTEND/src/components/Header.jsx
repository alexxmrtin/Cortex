import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from '../styles/Header.module.css';
import perfilNoDefinido from '../assets/perfilNoDefinido.jpg';
import apiClient from '../services/api';

export default function Header() {
  const location = useLocation();
  const token = localStorage.getItem('authToken');
  const [fotoPerfil, setFotoPerfil] = useState(perfilNoDefinido);

  // Tema actual (oscuro/claro), leido de localStorage
  const [temaOscuro, setTemaOscuro] = useState(function () {
    return localStorage.getItem('tema') === 'oscuro';
  });


  useEffect(function() {
    if (!token) return;

    async function cargarUsuario() {
      try {
        const respuesta = await apiClient.get('/usuarios/me');
        const data = respuesta.data;

        // Foto de perfil
        if (data.fotoPerfil) {
          setFotoPerfil(`${import.meta.env.VITE_API_URL}${data.fotoPerfil}`);
        }

        // Como el header se carga en todas las paginas, lo que hacemos es cargar dentro de localStorage el tema del usuario(lo obntenemos de la base de datos) para que asi se cargue el tema en las demas paginas.
        const oscuroBD = data.tema === 'oscuro';
        setTemaOscuro(oscuroBD);
        if (oscuroBD) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
        localStorage.setItem('tema', data.tema || 'claro');

      } catch (err) {
        console.error('Error al cargar el usuario', err);
      }
    }
    cargarUsuario();
  }, []);


  // Alterna el tema: lo aplica en <html>, lo persiste en localStorage y (si hay sesion) lo guarda en el backend
  async function alternarTema() {
    const nuevoOscuro = !temaOscuro;
    setTemaOscuro(nuevoOscuro);

    let nombreTema = 'claro';
    if (nuevoOscuro) {
      nombreTema = 'oscuro';
    }

    if (nuevoOscuro) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('tema', nombreTema);

    if (token) {
      try {
        await apiClient.patch('/usuarios/me', { tema: nombreTema });
      } catch (err) {
        console.error('Error al guardar el tema', err);
      }
    }
  }


  let headerClass = styles.header;
  if (location.pathname !== '/') {
    headerClass = headerClass + ' ' + styles.headerBorder;
  }

  // El boton se "ilumina" (ambar) cuando el tema oscuro esta activo
  let temaBtnClass = styles.temaBtn;
  if (temaOscuro) {
    temaBtnClass = temaBtnClass + ' ' + styles.temaBtnActivo;
  }

  // Lamparita para cambiar el tema (igual en ambas vistas)
  const botonTema = (
    <button type="button" className={temaBtnClass} onClick={alternarTema} aria-label="Cambiar tema" title="Cambiar tema">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6"/>
        <path d="M10 22h4"/>
        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
      </svg>
    </button>
  );

  if (token){
    return (
      <header className={headerClass}>
        <div className={styles.container}>
          <Link to="/" className={styles.logo}>
            <h1>Cortex 0.1v</h1>
          </Link>
          <nav className={styles.nav}>
            {botonTema}
            <Link to="/">Inicio</Link>
            <Link to="/ajustes">Ajustes</Link>
            <img src={fotoPerfil} alt="Perfil" className={styles.profileImg}/>
          </nav>
        </div>
      </header>
    );
  }

  else{
    return (
      <header className={headerClass}>
        <div className={styles.container}>
          <Link to="/" className={styles.logo}>
            <h1>Cortex 0.1v</h1>
          </Link>
          <nav className={styles.nav}>
            {botonTema}
            <Link to="/">Inicio</Link>
            <Link to="/login">Ajustes</Link>
            <img src={fotoPerfil} alt="Perfil" className={styles.profileImg}/>
          </nav>
        </div>
      </header>
    );
  }

}
