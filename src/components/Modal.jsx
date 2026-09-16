import { useEffect } from 'react'

export function Modal({ titre, sousTitre, onClose, children, actions, large = false }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`modal${large ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={titre}>
        <div className="modal-head">
          <div>
            <h3>{titre}</h3>
            {sousTitre && <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>{sousTitre}</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-foot">{actions}</div>}
      </div>
    </div>
  )
}

export function Confirm({ titre, message, confirmer = 'Confirmer', danger = false, onConfirm, onClose }) {
  return (
    <Modal titre={titre} onClose={onClose} actions={
      <>
        <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => { onConfirm(); onClose() }}>{confirmer}</button>
      </>
    }>
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  )
}
