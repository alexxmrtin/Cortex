import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Projects from './pages/Proyectos/index';
import ProjectPanel from './pages/Proyectos/ProjectPanel';
import AgregarProyecto from './pages/Proyectos/AgregarProyecto';
import CentroIA from './pages/CentroIA/index';
import EmptyStateIA from './pages/CentroIA/EmptyStateIA';
import ConversacionIA from './pages/CentroIA/ConversacionIA';
import Servicios from './pages/Servicios/index';
import ServicesPanel from './pages/Servicios/ServicesPanel';
import AgregarServicio from './pages/Servicios/AgregarServicio';
import ActualizarServicio from './pages/Servicios/ActualizarServicio';
import Ajustes from './pages/Ajustes';
import './App.css';

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          
          <Route path="/login" element={<Login />} />
          
          <Route path="/registro" element={<Register />} />

          {/*Usamos una ruta anidada con React Router, Renderizamos /proyects y dentro de el usando <outlet> reservamos un hueco donde react router puede insertar una ruta hija */}
          {/*En la ruta hija ":id" es un parametro dinamico, ese valor lo obtenemos del id de el proyecto */}
          <Route path='/proyectos' element={<Projects />}>
            <Route path=':id' element={<ProjectPanel />} />
            <Route path='agregarProyecto' element={<AgregarProyecto />} />
          </Route>

          <Route path='centroIA' element={<CentroIA />}>
            <Route index element={<EmptyStateIA />} /> {/* Index le dice a React Router que sta es la ruta por defecto*/}
            <Route path='conversacion/:id' element={<ConversacionIA />} />
          </Route>
          
          <Route path='/servicios' element={<Servicios/>}>
            <Route path=':id' element={<ServicesPanel />} />
            <Route path=':id/actualizar' element={<ActualizarServicio />} />
            <Route path='agregarServicio' element={<AgregarServicio />} />
          </Route>

          <Route path='/ajustes' element={<Ajustes />} />

        </Routes>
        <Footer />
      </div>
    </Router>
  );
}
