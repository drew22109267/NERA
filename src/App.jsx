import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Patients from './pages/Patients.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import Admission from './pages/Admission.jsx'
import Queue from './pages/Queue.jsx'
import Triage from './pages/Triage.jsx'
import Decision from './pages/Decision.jsx'
import Orientation from './pages/Orientation.jsx'
import Beds from './pages/Beds.jsx'
import Forecast from './pages/Forecast.jsx'
import Discharges from './pages/Discharges.jsx'
import UnmetDemand from './pages/UnmetDemand.jsx'
import Appointments from './pages/Appointments.jsx'
import Notifications from './pages/Notifications.jsx'
import Reports from './pages/Reports.jsx'
import Quality from './pages/Quality.jsx'
import Admin from './pages/Admin.jsx'
import Recherche from './pages/Recherche.jsx'
import MonEspace from './pages/MonEspace.jsx'
import Profil from './pages/Profil.jsx'
import NotFound from './pages/NotFound.jsx'

function Prive({ children }) {
  const { user, pret } = useAuth()
  if (!pret) return <div className="load-center" style={{ minHeight: '100vh' }}><span className="spinner" /> Chargement de la session…</div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { user, pret } = useAuth()
  if (!pret) return <div className="load-center" style={{ minHeight: '100vh' }}><span className="spinner" /></div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route element={<Prive><Layout /></Prive>}>
        {/* Un patient n'a pas de tableau de bord d'établissement : son accueil
            est son espace santé. */}
        <Route index element={user?.role === 'patient' ? <Navigate to="/mon-espace" replace /> : <Dashboard />} />
        <Route path="mon-espace" element={<MonEspace />} />
        <Route path="profil" element={<Profil />} />
        <Route path="utilisateurs/:id" element={<Profil />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="admission" element={<Admission />} />
        <Route path="file" element={<Queue />} />
        <Route path="triage/:id" element={<Triage />} />
        <Route path="decision/:id" element={<Decision />} />
        <Route path="orientation" element={<Orientation />} />
        <Route path="lits" element={<Beds />} />
        <Route path="prevision" element={<Forecast />} />
        <Route path="sorties" element={<Discharges />} />
        <Route path="demandes" element={<UnmetDemand />} />
        <Route path="rendez-vous" element={<Appointments />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="rapports" element={<Reports />} />
        <Route path="qualite" element={<Quality />} />
        <Route path="admin" element={<Admin />} />
        <Route path="donnees" element={<Recherche />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
