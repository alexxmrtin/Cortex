import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/ActualizarServicio.module.css';
import apiClient from '../../services/api';


// Pagina para actualizar los datos de un servicio.
// Obtiene el servicio del backend con el id de la URL, rellena cada campo con sus valores actuales y al enviar hace un PATCH para guardarlos.
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

  // --- Acceso SSH ---
  const [usuarioSSH, setUsuarioSSH] = useState('');
  const [puertoSSH, setPuertoSSH] = useState('22');
  const [clavePrivada, setClavePrivada] = useState(''); // vacio = NO cambiar la clave guardada
  const [passphrase, setPassphrase] = useState('');     // vacio = NO cambiar la passphrase guardada
  const [comandoArranque, setComandoArranque] = useState('');
  const [comandoParada, setComandoParada] = useState('');
  const [tieneClaveSSH, setTieneClaveSSH] = useState(false); // si ya hay una clave guardada (no la recibimos, solo el flag)

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

        // Campos SSH (la clave NO viaja: solo sabemos si existe por el flag tieneClaveSSH)
        setUsuarioSSH(servicio.usuarioSSH || '');
        if (servicio.puertoSSH) {
          setPuertoSSH(String(servicio.puertoSSH));
        } else {
          setPuertoSSH('22');
        }
        setComandoArranque(servicio.comandoArranque || '');
        setComandoParada(servicio.comandoParada || '');
        setTieneClaveSSH(servicio.tieneClaveSSH);

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

    // Construimos el cuerpo base. La clave y la passphrase se añaden SOLO si el usuario escribio algo, para no machacar las que ya estan guardadas al editar otra cosa.
    const cuerpo = {
      nombre: nombre,
      tipo: tipo,
      estado: estado,
      host: host,
      puerto: Number(puerto),
      proyectoAsociado: proyectoId,
      descripcion: descripcion,
      puertoSSH: Number(puertoSSH) || 22,
      usuarioSSH: usuarioSSH || null,
      comandoArranque: comandoArranque || null,
      comandoParada: comandoParada || null
    };

    if (clavePrivada) {
      cuerpo.clavePrivada = clavePrivada;
    }
    if (passphrase) {
      cuerpo.passphrase = passphrase;
    }

    try {
      await apiClient.patch('/servicios/' + id, cuerpo);
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


  // Texto de la etiqueta de la clave: distinto segun si ya hay una clave guardada o no
  let textoLabelClave;
  if (tieneClaveSSH) {
    textoLabelClave = 'Clave privada SSH (ya hay una guardada — déjalo vacío para no cambiarla)';
  } else {
    textoLabelClave = 'Clave privada SSH (se guarda cifrada)';
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

        <div className={styles.infoItem}>
          <label className={styles.infoLabel} htmlFor="usuarioSSH">Usuario SSH</label>
          <input
            id="usuarioSSH"
            className={styles.input}
            placeholder="root"
            value={usuarioSSH}
            onChange={function (e) { setUsuarioSSH(e.target.value); }}
          />
        </div>

        <div className={styles.infoItem}>
          <label className={styles.infoLabel} htmlFor="puertoSSH">Puerto SSH</label>
          <input
            id="puertoSSH"
            type="number"
            className={styles.input}
            value={puertoSSH}
            onChange={function (e) { setPuertoSSH(e.target.value); }}
          />
        </div>

        <div className={styles.infoItem}>
          <label className={styles.infoLabel} htmlFor="comandoArranque">Comando de arranque</label>
          <input
            id="comandoArranque"
            className={styles.input}
            placeholder="systemctl start nginx"
            value={comandoArranque}
            onChange={function (e) { setComandoArranque(e.target.value); }}
          />
        </div>

        <div className={styles.infoItem}>
          <label className={styles.infoLabel} htmlFor="comandoParada">Comando de parada</label>
          <input
            id="comandoParada"
            className={styles.input}
            placeholder="systemctl stop nginx"
            value={comandoParada}
            onChange={function (e) { setComandoParada(e.target.value); }}
          />
        </div>
      </div>

      {/*Bloque para la clave privada: si ya hay una guardada se avisa, y solo se reemplaza si escribes una nueva */}
      <div className={styles.descripcionBloque}>
        <label className={styles.descripcionLabel} htmlFor="clavePrivada">{textoLabelClave}</label>
        <textarea
          id="clavePrivada"
          className={styles.descripcionTexto}
          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
          value={clavePrivada}
          onChange={function (e) { setClavePrivada(e.target.value); }}
          style={{ fontFamily: 'monospace' }}
        />
      </div>

      <div className={styles.infoItem}>
        <label className={styles.infoLabel} htmlFor="passphrase">Passphrase de la clave (vacío = sin cambios)</label>
        <input
          id="passphrase"
          type="password"
          className={styles.input}
          placeholder="Solo si tu clave tiene passphrase"
          value={passphrase}
          onChange={function (e) { setPassphrase(e.target.value); }}
        />
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
