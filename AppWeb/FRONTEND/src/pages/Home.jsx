import { Link } from 'react-router-dom';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div>
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Saludos, usuario</h1>
          <Link to="/login">Iniciar sesión</Link>
        </section>
        <section className={styles.hero2}>
          <h4>Proyectos Recientes</h4>
          
          {/* La lista hacerla Dinámica, dejo la estructura para tener una idea de lo que quiero */}
          <ul>
            <li>Proyecto 1</li>
            <li>Proyecto 2</li>
            <li>Proyecto 3</li>
          </ul>
        </section>
      </main>

      
    </div>

  );
}
