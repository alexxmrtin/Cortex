# 🚀 SETUP REACT COMPLETO - CORTEX

---

## ✅ Lo que se ha instalado

### 🔧 Stack Tecnológico
- **Vite** - Bundler ultra-rápido (5-10x más rápido que Create React App)
- **React 19** - Última versión de React
- **React Router v7** - Enrutamiento de páginas
- **Axios** - Cliente HTTP para llamadas API
- **Lucide React** - 1500+ iconos SVG profesionales

### 📁 Estructura del Proyecto
```
FRONTEND/
├── src/
│   ├── components/        # Componentes reutilizables
│   │   ├── Header.jsx     # Navegación principal
│   │   └── Footer.jsx     # Pie de página
│   ├── pages/             # Páginas principales
│   │   ├── Home.jsx       # Página de inicio
│   │   └── About.jsx      # Página acerca de
│   ├── services/
│   │   └── api.js         # Cliente Axios configurado
│   ├── hooks/
│   │   └── useApi.js      # Hook para llamadas API
│   ├── styles/            # CSS modulares
│   │   ├── Header.module.css
│   │   ├── Footer.module.css
│   │   └── pages.module.css
│   ├── App.jsx            # Componente raíz con rutas
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── public/                # Archivos estáticos
├── .env.local             # Variables de entorno
├── .env.example           # Plantilla .env
├── vite.config.js         # Configuración Vite
├── package.json
└── README.md
```

---

### 1️⃣ Iniciar servidor de desarrollo
```bash
cd /home/alex/Proyectos/Cortex/AppWeb/FRONTEND
npm run dev
```
La app estará en: `http://localhost:5173`


---

## 🔌 Conectar con tu API Backend

### 1. Configurar URL de API

En `.env.local`, actualiza la URL (cuando tengas el backend corriendo):
```
REACT_APP_API_URL=http://localhost:5000/api
```

### 2. Hacer llamadas a API

**Opción A: Usar el hook `useApi`**
```jsx
import { useApi } from '../hooks/useApi';

export default function UserList() {
  const { data, error, loading } = useApi('/users');

  if (loading) return <p>Cargando...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <ul>
      {data?.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}
```

**Opción B: Usar Axios directamente**
```jsx
import { useEffect, useState } from 'react';
import apiClient from '../services/api';

export default function UserList() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    apiClient.get('/users')
      .then(res => setUsers(res.data))
      .catch(err => console.error(err));
  }, []);

  return <div>{/* renderizar usuarios */}</div>;
}
```

---

## 🎨 Agregar estilos

### Opción 1: CSS Modules (recomendado)
```css
/* src/styles/MyComponent.module.css */
.card {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
```

```jsx
import styles from '../styles/MyComponent.module.css';

export default function MyComponent() {
  return <div className={styles.card}>Contenido</div>;
}
```

### Opción 2: Tailwind CSS (opcional)
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## 📦 Comandos Disponibles

```bash
npm run dev       # Iniciar servidor desarrollo (hot reload)
npm run build     # Compilar para producción
npm run preview   # Ver build en localhost
npm run lint      # Verificar código
```

---

## 💡 Tips Importantes

✅ **Hot Reload**: Los cambios se reflejan automáticamente en el navegador
✅ **Módulos CSS**: Evita conflictos de nombres usando `.module.css`
✅ **Variables de entorno**: Siempre comienzan con `REACT_APP_`
✅ **Componentes pequeños**: Crea componentes reusables
✅ **Lazy loading**: Usa `React.lazy()` para optimizar

---

