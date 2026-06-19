import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from '../styles/Login.module.css';
import apiClient, { guardarToken } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(false);

  const [error, setError] = useState('');
  const navigate = useNavigate();

  function handleEmailChange(e) {
    setEmail(e.target.value);
  }

  function handlePasswordChange(e) {
    setPassword(e.target.value);
  }


  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      const respuesta = await apiClient.post('/usuarios/login', {
        email: email,
        contrasena: password,
        recordar: recordar
      });

      // Segun "recordarme": localStorage (persiste) o sessionStorage (se borra al cerrar el navegador)
      guardarToken(respuesta.data.access_token, recordar);
      navigate('/');

    } catch(err) {
      setError(err.response?.data?.detail || 'Error al iniciar sesión');
    }
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

          <label className={styles.recordar}>
            <input
              type="checkbox"
              checked={recordar}
              onChange={(e) => setRecordar(e.target.checked)}
            />
            Recordarme en este dispositivo
          </label>

          {error && <p className={styles.error}>{error}</p>}

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
