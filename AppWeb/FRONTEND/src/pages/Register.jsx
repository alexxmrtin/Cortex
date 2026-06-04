import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/Login.module.css';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function handleNameChange(e) {
    setName(e.target.value);
  }

  function handleEmailChange(e) {
    setEmail(e.target.value);
  }

  function handlePasswordChange(e) {
    setPassword(e.target.value);
  }

  function handleConfirmPasswordChange(e) {
    setConfirmPassword(e.target.value);
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Lógica de registro pendiente
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <div className={styles.cardHeader}>
          <span className={styles.logo}>⬡</span>
          <h1 className={styles.title}>Cortex</h1>
          <p className={styles.subtitle}>Crea tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">Nombre</label>
            <input
              id="name"
              type="text"
              className={styles.input}
              placeholder="Tu nombre"
              value={name}
              onChange={handleNameChange}
            />
          </div>

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

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirmPassword">Confirmar contraseña</label>
            <input
              id="confirmPassword"
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
            />
          </div>

          <button type="submit" className={styles.button}>
            Crear cuenta
          </button>
        </form>

        <p className={styles.footer}>
          ¿Ya tienes cuenta? <Link to="/login" className={styles.link}>Inicia sesión</Link>
        </p>

      </div>
    </div>
  );
}
