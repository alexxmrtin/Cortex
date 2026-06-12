import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from '../styles/Header.module.css';
import perfilNoDefinido from '../assets/perfilNoDefinido.jpg';
import apiClient from '../services/api';

export default function Header() {
  const location = useLocation();
  const token = localStorage.getItem('authToken');
  const [fotoPerfil, setFotoPerfil] = useState(perfilNoDefinido);


  useEffect(function() {
    if (!token) return;
    
    async function cargarFoto() {
      try {
        const respuesta = await apiClient.get('/usuarios/me');
        const url = respuesta.data.fotoPerfil;
        if (url) setFotoPerfil(`${import.meta.env.VITE_API_URL}${url}`);
      } catch (err) {
        console.error('Error al cargar la foto de perfil', err);
      }
    }
    cargarFoto();
  }, []);


  let headerClass = styles.header;
  if (location.pathname !== '/') {
    headerClass = headerClass + ' ' + styles.headerBorder;
  }

  if (token){
    return (
      <header className={headerClass}>
        <div className={styles.container}>
          <Link to="/" className={styles.logo}>
            <h1>Cortex 0.1v</h1>
          </Link>
          <nav className={styles.nav}>
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
            <Link to="/">Inicio</Link>
            <Link to="/login">Ajustes</Link>
            <img src={fotoPerfil} alt="Perfil" className={styles.profileImg}/>
          </nav>
        </div>
      </header>
    );
  }
  
}
