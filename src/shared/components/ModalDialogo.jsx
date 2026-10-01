// src/shared/components/ModalDialogo.jsx — Modal genérico de alerta / confirmação.
const ModalDialogo = ({ dialogo, aoFechar }) => {
  if (!dialogo.show) return null;
  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1080 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg">
          <div className="modal-header bg-dark text-white">
            <h5 className="modal-title fw-bold">{dialogo.title}</h5>
            <button type="button" className="btn-close btn-close-white" onClick={aoFechar}></button>
          </div>
          <div className="modal-body fs-6 py-4">
            {dialogo.message}
          </div>
          <div className="modal-footer">
            {dialogo.type === 'confirm' ? (
              <>
                <button className="btn btn-outline-secondary" onClick={aoFechar}>
                  {dialogo.cancelText}
                </button>
                <button className="btn btn-danger fw-bold" onClick={dialogo.onConfirm}>
                  {dialogo.confirmText}
                </button>
              </>
            ) : (
              <button className="btn btn-dark w-100 fw-bold" onClick={aoFechar}>
                OK
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalDialogo;
