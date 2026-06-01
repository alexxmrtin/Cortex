import { Link } from 'react-router-dom';
import styles from '../styles/Header.module.css';
import perfilImg from '../assets/perfilNoDefinido.jpg';  // ← Importa aquí

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          <h1>Cortex 0.1v</h1>
        </Link>
        <nav className={styles.nav}>
          <Link to="/">Inicio</Link>
          <Link to="/settings">Settings</Link>
          <Link to="/perfil"><img src={perfilImg} alt="Perfil" className={styles.profileImg}/></Link>
        </nav>
      </div>
    </header>
  );
}
