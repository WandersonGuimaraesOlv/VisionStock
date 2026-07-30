const Header = () => {
  return (
    <header className="app-header text-center py-3 bg-dark text-white mb-3 shadow-sm rounded-bottom">
      <div className="d-flex align-items-center justify-content-center gap-2">
        <span className="badge bg-danger fs-6 px-3 py-2 text-uppercase fw-bold tracking-wider">ALMOX</span>
        <h1 className="h5 m-0 fw-bold text-light d-none d-sm-inline">Sistema Universal de Inventário</h1>
      </div>
      <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
        Conferência Física & Conciliação em Tempo Real (SAP Ready)
      </small>
    </header>
  );
};

export default Header;