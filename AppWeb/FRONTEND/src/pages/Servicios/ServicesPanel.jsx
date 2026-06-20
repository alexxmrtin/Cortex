import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styles from '../../styles/ServicesPanel.module.css';
import apiClient from '../../services/api';

export default function ServicesPanel() {
  const { id } = useParams();
  
  const [servicio, setServicio] = useState(null);
  const [proyecto, setProyecto] = useState(null); // Proyecto asociado al servicio, se carga si proyectoAsociado tiene valor
  const [vivo, setVivo] = useState(null); // null = comprobando, true = responde, false = no responde (Saber si un servicio esta activo, la API devuelve true o false)
  const [cargando, setCargando] = useState(true);

  // Estado del control remoto por SSH
  const [accionando, setAccionando] = useState(false); // true mientras se ejecuta un encender/apagar
  const [mensajeAccion, setMensajeAccion] = useState(''); // texto de feedback tras la accion
  const [tipoMensaje, setTipoMensaje] = useState(''); // 'ok' o 'error', para pintar el mensaje

  useEffect(function() {
    async function cargarDatos() {
      try {
        const respuesta = await apiClient.get('/servicios/' + id);
        setServicio(respuesta.data);

        // Si el servicio tiene proyecto asociado, recogemos el proyecto de la API
        if (respuesta.data.proyectoAsociado) {
          const respProyecto = await apiClient.get('/proyectos/' + respuesta.data.proyectoAsociado);
          setProyecto(respProyecto.data);
        }

        // Una vez cargado el servicio, hacemos el ping para saber si esta vivo
        const ping = await apiClient.get('/servicios/' + id + '/ping');
        setVivo(ping.data.vivo);

        // Actualizamos el estado segun el resultado del ping
        let nuevoEstado;
        if (ping.data.vivo) {
          nuevoEstado = 'activo';
        } else {
          nuevoEstado = 'inactivo';
        }
        const actualizado = await apiClient.patch('/servicios/' + id, { estado: nuevoEstado });
        setServicio(actualizado.data);
      } catch (err) {
        console.error('Error al cargar el servicio', err);
      } finally {
        setCargando(false);
      }
    }
    cargarDatos();
  }, [id]);

  // Enciende o apaga el servicio ejecutando el comando por SSH en la maquina remota.
  // 'accion' es 'encender' o 'apagar'; 'nuevoEstado' es como queda el servicio si va bien.
  async function ejecutarAccionSSH(accion, nuevoEstado) {
    setAccionando(true);
    setMensajeAccion('');

    try {
      await apiClient.post('/servicios/' + id + '/' + accion);
      // El endpoint no devuelve el servicio entero, asi que actualizamos el estado en local.
      setServicio({ ...servicio, estado: nuevoEstado });
      setMensajeAccion('Servicio ' + nuevoEstado + ' correctamente');
      setTipoMensaje('ok');
    } catch (err) {
      console.error('Error al ' + accion + ' el servicio', err);
      setMensajeAccion(err.response?.data?.detail || 'No se pudo ' + accion + ' el servicio');
      setTipoMensaje('error');
    } finally {
      setAccionando(false);
    }
  }

  function encender() {
    ejecutarAccionSSH('encender', 'activo');
  }

  function apagar() {
    ejecutarAccionSSH('apagar', 'inactivo');
  }

  if (cargando) {
    return <p className={styles.noEncontrado}>Cargando...</p>;
  }

  if (!servicio) {
    return <p className={styles.noEncontrado}>Servicio no encontrado.</p>;
  }

  
  let textoEstado;
  if (servicio.estado === 'activo') {
    textoEstado = 'Activo';
  } else {
    textoEstado = 'Inactivo';
  }


  let claseEstadoBadge;
  if (servicio.estado === 'activo') {
    claseEstadoBadge = styles.estadoActivoBadge;
  } else {
    claseEstadoBadge = styles.estadoInactivoBadge;
  }


  // Texto del ping: null mientras comprueba, luego si responde o no
  let textoPing;
  if (vivo === null) {
    textoPing = 'Comprobando...';
  } else if (vivo) {
    textoPing = 'Responde';
  } else {
    textoPing = 'No responde';
  }

  // ── Control remoto por SSH ──
  // Texto que indica si el servicio tiene clave SSH guardada (no recibimos la clave, solo el flag)
  let textoClaveSSH;
  if (servicio.tieneClaveSSH) {
    textoClaveSSH = 'Configurada';
  } else {
    textoClaveSSH = 'No configurada';
  }

  // Clase del mensaje de feedback segun haya ido bien o mal la accion
  let claseMensaje;
  if (tipoMensaje === 'ok') {
    claseMensaje = styles.mensajeOk;
  } else {
    claseMensaje = styles.mensajeError;
  }

  // Los botones solo tienen sentido si existe el comando correspondiente. Se deshabilitan
  // tambien mientras hay una accion en curso para no lanzar dos a la vez.
  const puedeEncender = !accionando && Boolean(servicio.comandoArranque);
  const puedeApagar = !accionando && Boolean(servicio.comandoParada);

  // Mostramos SOLO el boton que tiene sentido: si el servicio esta encendido ofrecemos
  // "Apagar"; si esta apagado, "Encender". El estado se mantiene al dia con el ping (al
  // cargar) y con la ultima accion ejecutada.
  let botonControl;
  if (servicio.estado === 'activo') {
    botonControl = (
      <button type="button" className={styles.botonApagar} onClick={apagar} disabled={!puedeApagar}>
        Apagar
      </button>
    );
  } else {
    botonControl = (
      <button type="button" className={styles.botonEncender} onClick={encender} disabled={!puedeEncender}>
        Encender
      </button>
    );
  }

  return (
    <div className={styles.panel}>

      <div className={styles.cabecera}>
        <div>
          <h2 className={styles.titulo}>{servicio.nombre}</h2>
          <span className={styles.subtitulo}>{servicio.tipo}</span>
        </div>
        <span className={claseEstadoBadge}>{textoEstado}</span>
      </div>

      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Tipo de servidor</span>
          <span className={styles.infoValor}>{servicio.tipo}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Proyecto asociado</span>
          {proyecto
            ? <Link to={'/proyectos/' + proyecto.id} className={styles.infoValor}>{proyecto.nombreproyecto}</Link>
            : <span className={styles.infoValor}>—</span>
          } {/*Si el estado proyecto es null, se interpreta como false entonces mostrara el <span> */}
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Estado</span>
          <span className={claseEstadoBadge}>{textoEstado}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Host</span>
          <span className={styles.infoValor}>{servicio.host}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Puerto</span>
          <span className={styles.infoValor}>{servicio.puerto}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Conectividad</span>
          <span className={styles.infoValor}>{textoPing}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Usuario SSH</span>
          <span className={styles.infoValor}>{servicio.usuarioSSH || '—'}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Puerto SSH</span>
          <span className={styles.infoValor}>{servicio.puertoSSH || '—'}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Clave SSH</span>
          <span className={styles.infoValor}>{textoClaveSSH}</span>
        </div>
      </div>

      {/*Seccion de control remoto: enciende/apaga el servicio por SSH */}
      <div className={styles.controlSSH}>
        <span className={styles.infoLabel}>Control remoto (SSH)</span>
        <div className={styles.botonesSSH}>
          {botonControl}
        </div>
        {accionando && <span className={styles.infoValor}>Ejecutando comando por SSH...</span>}
        {mensajeAccion && <span className={claseMensaje}>{mensajeAccion}</span>}
      </div>

      {servicio.descripcion && (
        <div className={styles.descripcionBloque}>
          <span className={styles.descripcionLabel}>Descripción</span>
          <p className={styles.descripcionValor}>{servicio.descripcion}</p>
        </div>
      )}

    </div>
  );
}
