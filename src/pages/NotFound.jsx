import { Link } from 'react-router-dom'
import { PageHead, Empty } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <>
      <PageHead kicker="Erreur 404" title="Page introuvable" />
      <Empty titre="Cette adresse ne correspond à aucun écran">
        Le lien est peut-être obsolète, ou votre rôle ne donne pas accès à cet écran.
      </Empty>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link className="btn btn-primary" to="/">Retour au tableau de bord</Link>
      </div>
    </>
  )
}
