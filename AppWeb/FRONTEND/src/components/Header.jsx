import { Link, useLocation } from 'react-router-dom';
import styles from '../styles/Header.module.css';
import perfilImg from '../assets/perfilNoDefinido.jpg';

export default function Header() {
  const location = useLocation();

  let headerClass = styles.header;
  if (location.pathname !== '/') {
    headerClass = headerClass + ' ' + styles.headerBorder;
  }

  return (
    <header className={headerClass}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          <h1>Cortex 0.1v</h1>
        </Link>
        <nav className={styles.nav}>
          <Link to="/">Inicio</Link>
          <Link to="/settings">Ajustes</Link>
          <Link to="/perfil"><img src={perfilImg} alt="Perfil" className={styles.profileImg}/></Link>
        </nav>
      </div>
    </header>
  );
}
