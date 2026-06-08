import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'; //Intenta leer la url de la API en una variable de entorno si no existe usa la otra por default, FastAPI corre en el puerto 800


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
