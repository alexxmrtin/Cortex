import axios from 'axios';

// Fuente UNICA de verdad de la URL del backend. Se exporta para que toda la app  (peticiones axios y URLs de imagenes en Storage) use el mismo valor con su fallback. Si VITE_API_URL no llega en el build, cae a localhost:8000 en TODOS los sitios, no solo aqui.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';


//Creamos una instancia de axios preconfigurada , en lugar de escribir la url completa en cada peticion, escribes solo el endpoint
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});



// --- Manejo del token segun el "recordarme" del login ---
// Si el usuario marca "recordarme", guardamos el token en localStorage (sobrevive a cerrar el navegador).
// Si no lo marca, lo guardamos en sessionStorage (se borra al cerrar la pestaña/navegador).
// Centralizamos aqui leer/guardar/borrar para que el resto de la app no tenga que saber en cual de los dos esta.

// Guarda el token en el almacen que corresponda segun 'recordar'. Limpia el otro para no dejar tokens duplicados.
export function guardarToken(token, recordar) {
  if (recordar) {
    localStorage.setItem('authToken', token);
    sessionStorage.removeItem('authToken');
  } else {
    sessionStorage.setItem('authToken', token);
    localStorage.removeItem('authToken');
  }
}



// Devuelve el token este donde este (localStorage o sessionStorage), o null si no hay sesion.
export function obtenerToken() {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

// Borra el token de los dos almacenes (cerrar sesion / eliminar cuenta).
export function borrarToken() {
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');
}




// Este es un middleware del frontend, se ejecuta automaticamente antes de cada peticion que hagas con la instancia "apiCLient" creada anteriormente.
//Lo que hace es mirar en el navegador si hay un token, si existe lo añade al header "Authorization: Bearer <token>" y la devuelve con ese parametro modificado
apiClient.interceptors.request.use(

  (config) => {
    const token = obtenerToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
