// src/shared/hooks/useDialogo.js — Estado do modal genérico de alerta / confirmação.
import { useCallback, useState } from 'react';

const FECHADO = { show: false, title: '', message: '', type: 'alert', onConfirm: null, confirmText: 'Sim', cancelText: 'Cancelar' };

export function useDialogo() {
  const [dialogo, setDialogo] = useState(FECHADO);

  const fechar = useCallback(() => setDialogo(prev => ({ ...prev, show: false })), []);

  const abrirAlerta = useCallback((title, message) => {
    setDialogo({ ...FECHADO, show: true, title, message });
  }, []);

  const abrirConfirmacao = useCallback((title, message, acaoConfirmar, confirmText = 'Sim', cancelText = 'Cancelar') => {
    setDialogo({
      show: true, title, message, type: 'confirm', confirmText, cancelText,
      onConfirm: () => { fechar(); acaoConfirmar(); },
    });
  }, [fechar]);

  return { dialogo, fechar, abrirAlerta, abrirConfirmacao };
}
