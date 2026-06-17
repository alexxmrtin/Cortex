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


// Este es un middleware del frontend, se ejecuta automaticamente antes de cada peticion que hagas con la instancia "apiCLient" creada anteriormente.
//Lo que hace es mirar en el navegador si hay un token en localStorage, si existe lo añade al header "Authorization: Bearer <token>" y la devuelve con ese parametro modificado 
apiClient.interceptors.request.use(

  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
