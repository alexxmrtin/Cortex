import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Projects from './pages/Projects';
import ProjectPanel from './pages/ProjectPanel';
import AgregarProyecto from './pages/AgregarProyecto';
import CentroIA from './pages/CentroIA';
import Servicios from './pages/Services';
import ServicesPanel from './pages/ServicesPanel';
import AgregarServicio from './pages/AgregarServicio';
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

          <Route path='centroIA' element={<CentroIA />}></Route>
          <Route path='/servicios' element={<Servicios/>}>
            <Route path=':id' element={<ServicesPanel />} />
            <Route path='agregarServicio' element={<AgregarServicio />} />
          </Route>

        </Routes>
        <Footer />
      </div>
    </Router>
  );
}
