// src/modules/inventario/Bipagem.jsx — Passo 3: leitura por leitor USB/teclado, câmera ou vídeo de drone.
import { useEffect, useRef, useState } from 'react';
import Scanner from '../../shared/components/Scanner';
import { ProcessadorDrone } from '../drone';
import UltimasLeituras from './UltimasLeituras';

const Bipagem = ({ deposito, endereco, leituras, bloqueado, aoLerCodigos, aoAlterarLocal }) => {
  const [codigo, setCodigo] = useState('');
  const [modo, setModo] = useState('teclado'); // teclado | camera | drone
  const inputRef = useRef(null);

  // Mantém o foco no campo para leitores USB/Bluetooth que "digitam" o código
  useEffect(() => {
    if (modo !== 'teclado' || bloqueado) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [modo, bloqueado]);

  const bipar = () => {
    if (!codigo.trim()) return;
    aoLerCodigos([codigo]);
    setCodigo('');
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="fw-bold m-0">3. Bipagem de Materiais</h4>
          <small className="text-muted">
            Local: <strong>{deposito || 'Geral'}</strong> | {endereco ? `Endereço: ${endereco}` : 'Sem Endereço'}
          </small>
        </div>
        <button className="btn btn-sm btn-outline-secondary" onClick={aoAlterarLocal}>
          Alterar Local
        </button>
      </div>

      {modo === 'camera' && (
        <Scanner
          aoLerCodigo={(lido) => { setModo('teclado'); aoLerCodigos([lido]); }}
          aoCancelar={() => setModo('teclado')}
        />
      )}

      {modo === 'drone' && (
        <ProcessadorDrone
          aoConcluir={(codigos) => { setModo('teclado'); aoLerCodigos(codigos); }}
          aoCancelar={() => setModo('teclado')}
        />
      )}

      {modo === 'teclado' && (
        <div className="my-3">
          <div className="input-group input-group-lg mb-3">
            <input
              ref={inputRef}
              type="text"
              className="form-control font-monospace border-danger border-2 fs-4 text-uppercase"
              placeholder="Bipe o código do Material (SKU)..."
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  bipar();
                }
              }}
            />
            <button className="btn btn-danger fw-bold px-4" onClick={bipar}>
              Bipar
            </button>
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-outline-dark w-50 py-2 d-flex align-items-center justify-content-center gap-2" onClick={() => setModo('camera')}>
              📷 Usar Câmera
            </button>
            <button className="btn btn-outline-primary w-50 py-2 d-flex align-items-center justify-content-center gap-2" onClick={() => setModo('drone')}>
              🛸 Vídeo de Drone (IA)
            </button>
          </div>
        </div>
      )}

      <UltimasLeituras leituras={leituras} />
    </div>
  );
};

export default Bipagem;
