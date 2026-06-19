import { useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import styles from '../styles/Login.module.css';
import apiClient, { guardarToken } from '../services/api'

export default function Register() {
  const [name, setName] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const navigate = useNavigate();

  function handleNameChange(e) {
    setName(e.target.value);
  }

  function handleEmailChange(e) {
    setCorreo(e.target.value);
  }

  function handlePasswordChange(e) {
    setPassword(e.target.value);
  }

  function handleConfirmPasswordChange(e) {
    setConfirmPassword(e.target.value);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    try {
      await apiClient.post('/usuarios/registro', {
        nombreUsuario: name,
        email: correo,
        contrasena: password
      });

      //Al registrarme, me logeo automaticamente
      const login = await apiClient.post('/usuarios/login', {
        email: correo,
        contrasena: password
      });
      // Tras registrarse iniciamos sesion normal (sin "recordarme"): se guarda en sessionStorage
      guardarToken(login.data.access_token, false);
      navigate('/');
    }
    catch (err){
      setError(err.response?.data?.detail || 'Error al registrarse');
    }
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
            <label className={styles.label} htmlFor="correo">Correo electrónico</label>
            <input
              id="correo"
              type="correo"
              className={styles.input}
              placeholder="email@ejemplo.com"
              value={correo}
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

          {error && <p className={styles.error}>{error}</p>}

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
