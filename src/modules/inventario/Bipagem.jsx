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
    <div className="vp-card no-hover" style={{ margin: 0 }}>
      <div className="d-flex justify-content-between align-items-start mb-3 gap-2">
        <div>
          <span className="vp-micro-label m-0">Leitura Ativa</span>
          <h3 className="vp-title mb-1">Bipagem de Materiais</h3>
          <small className="text-muted">
            <i className="bi bi-geo-alt me-1"></i>Depósito <strong>{deposito || 'Geral'}</strong>{endereco ? <> · Endereço <strong>{endereco}</strong></> : ' · sem endereço'}
          </small>
        </div>
        <button className="vp-btn vp-btn-outline vp-btn-sm" onClick={aoAlterarLocal}>
          <i className="bi bi-pencil"></i> Local
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
          <div className="d-flex gap-2 mb-3">
            <input
              ref={inputRef}
              type="text"
              className="vp-input vp-input-lg vp-input-destaque flex-grow-1 vp-mono text-uppercase"
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
            <button className="vp-btn vp-btn-primary vp-btn-lg px-4" onClick={bipar}>
              Bipar
            </button>
          </div>

          <div className="d-flex gap-2">
            <button className="vp-btn vp-btn-outline w-50" onClick={() => setModo('camera')}>
              <i className="bi bi-camera"></i> Usar Câmera
            </button>
            <button className="vp-btn vp-btn-outline w-50" onClick={() => setModo('drone')}>
              <i className="bi bi-camera-video"></i> Vídeo de Drone
            </button>
          </div>
        </div>
      )}

      <UltimasLeituras leituras={leituras} />
    </div>
  );
};

export default Bipagem;
