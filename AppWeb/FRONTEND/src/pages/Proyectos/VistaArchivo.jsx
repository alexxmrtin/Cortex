import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from '../../services/api';
import styles from '../../styles/VistaArchivo.module.css';

//-----------------------------------------------------------------------------------------------------------
//BLOQUE DE ADAPTADOR DE TITULO: el path del archivo puede ser muy grande, he creado esta solucion que se adapta si el titulo no dispone de suficiente ancho


// Acorta una ruta dejando solo la primera carpeta y el nombre del archivo: "src/a/b/c.js" -> "src/.../c.js"
function acortarRuta(ruta) {
    const partes = ruta.split('/');
    if (partes.length <= 2) {
        return ruta; // no hay nada en medio que colapsar
    }
    const primero = partes[0];
    const ultimo = partes[partes.length - 1];
    return primero + '/.../' + ultimo;
}

// Muestra la ruta del archivo y, si no cabe en el ancho disponible, la acorta por el medio.
// Reacciona a los cambios de ancho (por ejemplo al abrir/cerrar el panel de IA) con un ResizeObserver.
function TituloArchivo({ ruta }) {
    const contenedorRef = useRef(null); // el <h2> visible (su ancho = espacio disponible)
    const medidorRef = useRef(null);    // span oculto con la ruta COMPLETA (para medir cuanto ocuparia entera)
    const [rutaMostrada, setRutaMostrada] = useState(ruta);

    //useLayaoutEffect se ejecuta cada vez que el estado ruta cambia, se ejecuta antes de que el navegador renderize nada
    useLayoutEffect(function () {
        function ajustar() {
            const contenedor = contenedorRef.current;
            const medidor = medidorRef.current;
            if (!contenedor || !medidor) {
                return;
            }
            // Comparamos el ancho que ocuparia la ruta entera con el ancho disponible del h2
            if (medidor.offsetWidth <= contenedor.clientWidth) {
                setRutaMostrada(ruta);
            } else {
                setRutaMostrada(acortarRuta(ruta));
            }
        }

        ajustar();

        // Re-mide cuando cambia el ancho del contenedor (resize de ventana, abrir/cerrar panel IA...)
        const observer = new ResizeObserver(ajustar);
        if (contenedorRef.current) {
            observer.observe(contenedorRef.current);
        }
        return function () {
            observer.disconnect();
        };
    }, [ruta]);

    return (
        <h2 ref={contenedorRef} className={styles.titulo}>
            {rutaMostrada}
            {/* Copia oculta con la ruta completa: solo sirve para medir, no se ve ni ocupa espacio */}
            <span ref={medidorRef} className={styles.medidor}>{ruta}</span>
        </h2>
    );
}

//------------------------------------------------------------------------------------------------------------

export default function VistaArchivo(){
    const { id, archivoId } = useParams(); //La url de esta pagina es /proyectos/{id}/archivo/{archivoId}. id es el proyecto, archivoId es el archivo

    const [archivo, setArchivo] = useState(null);   // {nombre, rutaRelativa, contenido}
    const [cargando, setCargando] = useState(true); // true mientras esperamos la respuesta
    const [error, setError] = useState(null);       // mensaje de error si la carga falla


    useEffect(function(){
        async function cargarArchivo(){
            setCargando(true);
            setError(null);
            try {
                // Llamamos al endpoint de contenido con el id del archivo (no el del proyecto)
                const respuesta = await apiClient.get('/archivos/' + archivoId + '/contenido');
                setArchivo(respuesta.data); // {nombre, rutaRelativa, contenido}
            } catch (err) {
                console.error('Error al cargar el archivo', err);
                // El backend devuelve 415 cuando el archivo es binario (imagen, pdf...) y no se puede leer como texto
                if (err.response && err.response.status === 415) {
                    setError('Este archivo no se puede previsualizar como texto.');
                } 
                else if (err.response && err.response.status === 404){
                    setError('Archivo no encontrado')
                }
                else {
                    setError('No se ha podido cargar el archivo.');
                }
            } finally {
                setCargando(false);
            }
        }
        cargarArchivo();
    }, [archivoId]); // Se vuelve a ejecutar al navegar de un archivo a otro


    //Estilos
    if (cargando) {
        return <p className={styles.noEncontrado}>Cargando archivo...</p>;
    }
    if (error) {
        return <p className={styles.noEncontrado}>{error}</p>;
    }
    if (!archivo) {
        return <p className={styles.noEncontrado}>Archivo no encontrado.</p>;
    }


    // Calculamos las lineas del archivo usando split() y vamos creando un array donde en cada iteracion de linea en el archivo sumamos el numero de la linea
    // Ese array luego lo renderizamos junto con el contenido del archivo con css
    const lineas = archivo.contenido.split('\n');
    const numerosLinea = [];
    for (let i = 0; i < lineas.length; i++) {
        numerosLinea.push(i + 1);
    }


    // Mostramos el contenido dentro de un <pre> para respetar los saltos de linea y la indentacion del codigo
    return (
        <div className={styles.panel}>
            <Link to={'/proyectos/' + id} className={styles.volver}>
                ← Volver al proyecto
            </Link>

            <TituloArchivo ruta={archivo.rutaRelativa} />

            <div className={styles.visor}>
                {/*<pre> respeta el formato del texto, es decir, respeta saltos de linea, espaciados, sangrias... */}
                <pre className={styles.numeros}>{numerosLinea.join('\n')}</pre>
                <pre className={styles.codigo}>{archivo.contenido}</pre>
            </div>
        </div>
    );
}
