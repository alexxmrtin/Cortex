import styles from '../styles/pages.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1>Bienvenido a Cortex</h1>
        <p>Tu aplicación frontend está lista para desarrollar</p>
      </section>
    </main>
  );
}
