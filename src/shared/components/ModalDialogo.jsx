// src/shared/components/ModalDialogo.jsx — Modal genérico de alerta / confirmação.
const ModalDialogo = ({ dialogo, aoFechar }) => {
  if (!dialogo.show) return null;
  return (
    <div className="modal fade show d-block vp-modal-overlay" tabIndex="-1" style={{ zIndex: 1080 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">{dialogo.title}</h5>
            <button type="button" className="btn-close" onClick={aoFechar}></button>
          </div>
          <div className="modal-body fs-6 py-4">
            {dialogo.message}
          </div>
          <div className="modal-footer border-0 justify-content-center pb-4 gap-2">
            {dialogo.type === 'confirm' ? (
              <>
                <button className="vp-btn vp-btn-outline" onClick={aoFechar}>
                  {dialogo.cancelText}
                </button>
                <button className="vp-btn vp-btn-primary" onClick={dialogo.onConfirm}>
                  {dialogo.confirmText}
                </button>
              </>
            ) : (
              <button className="vp-btn vp-btn-dark w-100" onClick={aoFechar}>
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
