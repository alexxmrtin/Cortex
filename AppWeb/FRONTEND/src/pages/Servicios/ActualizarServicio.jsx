import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/ActualizarServicio.module.css';
import apiClient from '../../services/api';


// Pagina para actualizar los datos de un servicio.
// Obtiene el servicio del backend con el id de la URL, rellena cada campo con sus valores
// actuales y al enviar hace un PATCH para guardarlos.
export default function ActualizarServicio() {
  const { id } = useParams();   // id del servicio leido de la URL /servicios/:id/actualizar
  const navigate = useNavigate();

  // Un estado por cada campo editable
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('activo');
  const [host, setHost] = useState('');
  const [puerto, setPuerto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [proyectoAsociado, setProyectoAsociado] = useState(''); // id del proyecto elegido ('' = sin proyecto)

  const [proyectos, setProyectos] = useState([]); // lista de proyectos del usuario, para las opciones del select
  const [error, setError] = useState('');         // mensaje de error a mostrar si algo falla


  // Al entrar pedimos los proyectos y el servicio a la vez, y rellenamos cada campo con sus valores actuales
  useEffect(function () {
    async function cargarDatos() {
      try {
        const [respProyectos, respServicio] = await Promise.all([
          apiClient.get('/proyectos/'),
          apiClient.get('/servicios/' + id)
        ]);

        const servicio = respServicio.data;

        setProyectos(respProyectos.data);
        setNombre(servicio.nombre || '');
        setTipo(servicio.tipo || '');
        setEstado(servicio.estado || 'activo');
        setHost(servicio.host || '');
        setPuerto(servicio.puerto || '');
        setDescripcion(servicio.descripcion || '');

        // El proyecto asociado se guarda como id; lo pasamos a texto para que case con el value de las <option>
        if (servicio.proyectoAsociado) {
          setProyectoAsociado(String(servicio.proyectoAsociado));
        } else {
          setProyectoAsociado('');
        }
      } catch (err) {
        console.error('Error al cargar el servicio', err);
        setError(err.response?.data?.detail || 'No se pudo cargar el servicio');
      }
    }
    cargarDatos();
  }, [id]);


  // Envia los cambios al backend con un PATCH y, si va bien, vuelve al panel del servicio
  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); // limpiamos cualquier error anterior antes de reintentar

    // Si no hay proyecto elegido mandamos null (desvincula); si hay, el id como numero (la columna es Integer)
    let proyectoId = null;
    if (proyectoAsociado) {
      proyectoId = Number(proyectoAsociado);
    }

    try {
      await apiClient.patch('/servicios/' + id, {
        nombre: nombre,
        tipo: tipo,
        estado: estado,
        host: host,
        puerto: Number(puerto),
        proyectoAsociado: proyectoId,
        descripcion: descripcion
      });
      navigate('/servicios/' + id); // volvemos al panel, que ya mostrara los datos actualizados
    } catch (err) {
      console.error('Error al actualizar el servicio', err);
      setError(err.response?.data?.detail || 'No se pudo actualizar el servicio');
    }
  }


  // Opciones del desplegable de proyectos
  const opcionesProyecto = [];
  for (let i = 0; i < proyectos.length; i++) {
    const p = proyectos[i];
    opcionesProyecto.push(
      <option key={p.id} value={String(p.id)}>{p.nombreproyecto}</option>
    );
  }


  return (
    <form className={styles.panel} onSubmit={handleSubmit}>
      <h2 className={styles.titulo}>Actualizar servicio</h2>

      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <label className={styles.infoLabel} htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            className={styles.input}
            value={nombre}
            onChange={function (e) { setNombre(e.target.value); }}
          />
        </div>

        <div className={styles.infoItem}>
          <label className={styles.infoLabel} htmlFor="tipo">Tipo de servidor</label>
          <input
            id="tipo"
            className={styles.input}
            value={tipo}
            onChange={function (e) { setTipo(e.target.value); }}
          />
        </div>

        <div className={styles.infoItem}>
          <label className={styles.infoLabel} htmlFor="proyecto">Proyecto asociado</label>
          <select
            id="proyecto"
            className={styles.select}
            value={proyectoAsociado}
            onChange={function (e) { setProyectoAsociado(e.target.value); }}
          >
            <option value="">Sin proyecto</option>
            {opcionesProyecto}
          </select>
        </div>

        <div className={styles.infoItem}>
          <label className={styles.infoLabel} htmlFor="estado">Estado</label>
          <select
            id="estado"
            className={styles.select}
            value={estado}
            onChange={function (e) { setEstado(e.target.value); }}
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>

        <div className={styles.infoItem}>
          <label className={styles.infoLabel} htmlFor="host">Host</label>
          <input
            id="host"
            className={styles.input}
            value={host}
            onChange={function (e) { setHost(e.target.value); }}
          />
        </div>

        <div className={styles.infoItem}>
          <label className={styles.infoLabel} htmlFor="puerto">Puerto</label>
          <input
            id="puerto"
            type="number"
            className={styles.input}
            value={puerto}
            onChange={function (e) { setPuerto(e.target.value); }}
          />
        </div>
      </div>

      <div className={styles.descripcionBloque}>
        <label className={styles.descripcionLabel} htmlFor="descripcion">Descripción</label>
        <textarea
          id="descripcion"
          className={styles.descripcionTexto}
          placeholder="Escribe una descripción del servicio..."
          value={descripcion}
          onChange={function (e) { setDescripcion(e.target.value); }}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button type="submit" className={styles.submit}>Guardar cambios</button>
    </form>
  );
}
