import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styles from '../../styles/ServicesPanel.module.css';
import apiClient from '../../services/api';

// Estilos inline para el panel de monitorizacion (no tocamos el CSS module).
const estiloTarjeta = { display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' };
const estiloTarjetaLabel = { fontSize: '0.78rem', opacity: 0.7 };
const estiloTarjetaValor = { fontSize: '1.3rem', fontWeight: 700 };

// Color de la barra segun el porcentaje: verde (ok), ambar (medio), rojo (alto). Gris si no hay dato.
function colorPorcentaje(valor) {
  if (valor === null || valor === undefined) {
    return '#6b7280';
  }
  if (valor < 60) {
    return '#22c55e';
  }
  if (valor < 85) {
    return '#f59e0b';
  }
  return '#ef4444';
}

// Barra de progreso para una metrica en porcentaje (CPU, RAM, disco). 'detalle' es un texto opcional al lado de la etiqueta (ej: "8579 / 32002 MB").
function BarraMetrica(props) {
  const porcentaje = props.porcentaje;

  let texto;
  let ancho;
  if (porcentaje === null || porcentaje === undefined) {
    texto = 'N/D';
    ancho = 0;
  } else {
    texto = porcentaje + '%';
    ancho = porcentaje;
  }

  let etiquetaCompleta = props.etiqueta;
  if (props.detalle) {
    etiquetaCompleta = props.etiqueta + ' · ' + props.detalle;
  }

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.85rem' }}>
        <span style={{ opacity: 0.85 }}>{etiquetaCompleta}</span>
        <span style={{ fontWeight: 600 }}>{texto}</span>
      </div>
      <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ width: ancho + '%', height: '100%', background: colorPorcentaje(porcentaje), transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

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

  // Metricas de monitorizacion (CPU, RAM, disco, carga, latencia)
  const [metricas, setMetricas] = useState(null);
  const [cargandoMetricas, setCargandoMetricas] = useState(true);

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

  // Carga las metricas al entrar y las refresca cada 20s. 'activo' evita actualizar el estado si el componente ya se desmonto (el usuario salio del panel) cuando llega la respuesta.
  useEffect(function() {
    let activo = true;

    async function cargarMetricas() {
      try {
        const resp = await apiClient.get('/servicios/' + id + '/metricas');
        if (activo) {
          setMetricas(resp.data);
        }
      } catch (err) {
        console.error('Error al cargar las metricas', err);
      } finally {
        if (activo) {
          setCargandoMetricas(false);
        }
      }
    }

    cargarMetricas();
    const intervalo = setInterval(cargarMetricas, 20000);

    return function() {
      activo = false;
      clearInterval(intervalo);
    };
  }, [id]);

  // Enciende o apaga el servicio ejecutando el comando por SSH en la maquina remota. 'accion' es 'encender' o 'apagar'; 'nuevoEstado' es como queda el servicio si va bien.
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

  // Los botones solo tienen sentido si existe el comando correspondiente. Se deshabilitan tambien mientras hay una accion en curso para no lanzar dos a la vez.
  const puedeEncender = !accionando && Boolean(servicio.comandoArranque);
  const puedeApagar = !accionando && Boolean(servicio.comandoParada);

  // Mostramos SOLO el boton que tiene sentido: si el servicio esta encendido ofrecemos "Apagar"; si esta apagado, "Encender". El estado se mantiene al dia con el ping (alcargar) y con la ultima accion ejecutada.
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

  // ── Panel de monitorizacion ──
  // Preparamos los textos y el contenido fuera del JSX para no meter logica en el render.
  let textoLatencia = 'N/D';
  let textoCarga = 'N/D';
  let detalleRam = '';
  if (metricas) {
    if (metricas.latenciaMs !== null && metricas.latenciaMs !== undefined) {
      textoLatencia = metricas.latenciaMs + ' ms';
    }
    if (metricas.carga1 !== null && metricas.carga1 !== undefined) {
      textoCarga = metricas.carga1 + ' · ' + metricas.carga5 + ' · ' + metricas.carga15;
    }
    if (metricas.ramUsadaMb !== null && metricas.ramTotalMb !== null) {
      detalleRam = metricas.ramUsadaMb + ' / ' + metricas.ramTotalMb + ' MB';
    }
  }

  let contenidoMetricas;
  if (cargandoMetricas) {
    contenidoMetricas = <span className={styles.infoValor}>Cargando métricas...</span>;
  } else if (!metricas) {
    contenidoMetricas = <span className={styles.infoValor}>No se pudieron cargar las métricas.</span>;
  } else {
    contenidoMetricas = (
      <div>
        {/* Aviso si las metricas de la maquina no se pudieron leer (sin SSH, maquina caida...) */}
        {!metricas.sshOk && metricas.error && (
          <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', color: '#fca5a5', fontSize: '0.85rem' }}>
            {metricas.error}
          </div>
        )}

        {/* Latencia y carga: valores destacados en tarjetas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div style={estiloTarjeta}>
            <span style={estiloTarjetaLabel}>Latencia</span>
            <span style={estiloTarjetaValor}>{textoLatencia}</span>
          </div>
          <div style={estiloTarjeta}>
            <span style={estiloTarjetaLabel}>Carga (1·5·15 min)</span>
            <span style={estiloTarjetaValor}>{textoCarga}</span>
          </div>
        </div>

        {/* CPU, RAM y disco: barras de progreso con color por umbral */}
        <BarraMetrica etiqueta="CPU" porcentaje={metricas.cpuPorcentaje} />
        <BarraMetrica etiqueta="Memoria RAM" porcentaje={metricas.ramPorcentaje} detalle={detalleRam} />
        <BarraMetrica etiqueta="Disco" porcentaje={metricas.discoPorcentaje} />
      </div>
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

      {/* Panel de monitorizacion: metricas en vivo (se refrescan cada 20s) */}
      <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <span className={styles.infoLabel}>Monitorización</span>
        <div style={{ marginTop: '14px' }}>
          {contenidoMetricas}
        </div>
      </div>

    </div>
  );
}
