import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleEmailChange(e) {
    setEmail(e.target.value);
  }

  function handlePasswordChange(e) {
    setPassword(e.target.value);
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Lógica de login pendiente
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <div className={styles.cardHeader}>
          <span className={styles.logo}>⬡</span>
          <h1 className={styles.title}>Cortex</h1>
          <p className={styles.subtitle}>Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={handleEmailChange}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={handlePasswordChange}
            />
          </div>

          <button type="submit" className={styles.button}>
            Iniciar sesión
          </button>
        </form>

        <p className={styles.footer}>
          ¿No tienes cuenta? <Link to="/registro" className={styles.link}>Regístrate</Link>
        </p>

      </div>
    </div>
  );
}
