// src/modules/inventario/useInventario.js
// Estado do inventário: base SAP, leituras físicas, local de contagem e fila do modal de quantidade.
// O IndexedDB (Dexie) é a fonte de verdade; o estado React é só o espelho para a tela.
import { useCallback, useEffect, useMemo, useState } from 'react';
import db from '../../shared/lib/db';
import { playAlertSound, playSalvo, playSucesso } from '../../shared/lib/audio';
import { ETAPAS } from '../../app/estados';
import { indexarPorMaterial, validarLeitura } from './validarLeitura';

const CHAVE_SESSAO = 'almox_sessao_id';

// A versão anterior guardava a sessão no sessionStorage ("sessao_id"): reaproveita para não perder as contagens
const lerSessaoSalva = () => {
  try { return localStorage.getItem(CHAVE_SESSAO) || sessionStorage.getItem('sessao_id') || null; } catch { return null; }
};

const novoIdLeitura = () =>
  `l-${(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)}`;

export function useInventario({ operador, abrirAlerta, aoRegistrar }) {
  const [sessaoId, setSessaoId] = useState(lerSessaoSalva);
  const [itensSap, setItensSap] = useState([]);
  const [leituras, setLeituras] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [etapa, setEtapa] = useState(ETAPAS.IMPORT_SAP);
  const [depositoAtual, setDepositoAtual] = useState('');
  const [enderecoAtual, setEnderecoAtual] = useState('');
  // Fila do modal de quantidade: leituras em massa (drone) entram aqui uma a uma
  const [filaColeta, setFilaColeta] = useState([]);

  const indice = useMemo(() => indexarPorMaterial(itensSap), [itensSap]);

  useEffect(() => {
    try {
      if (sessaoId) localStorage.setItem(CHAVE_SESSAO, sessaoId);
      else localStorage.removeItem(CHAVE_SESSAO);
    } catch { /* armazenamento indisponível: segue só em memória */ }
  }, [sessaoId]);

  // Restaura a sessão do IndexedDB ao abrir o app (sobrevive a fechar a aba/PWA)
  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      if (!sessaoId) { setCarregado(true); return; }
      try {
        const [sap, lidas] = await Promise.all([
          db.itens_sap_cache.where('sessao_id').equals(sessaoId).toArray(),
          db.leituras_pendentes.where('sessao_id').equals(sessaoId).toArray(),
        ]);
        if (!ativo) return;
        setItensSap(sap.map(({ id: _id, sessao_id: _s, ...item }) => item));
        setLeituras(lidas.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
      } catch (err) {
        console.warn('Falha ao restaurar sessão do IndexedDB:', err);
      } finally {
        if (ativo) setCarregado(true);
      }
    };
    carregar();
    return () => { ativo = false; };
    // Só na abertura do app: depois disso o estado é mantido pelas ações abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const garantirSessao = useCallback(() => {
    if (sessaoId) return sessaoId;
    const novo = `sessao-${Date.now()}`;
    setSessaoId(novo);
    return novo;
  }, [sessaoId]);

  const importarItens = async (itens) => {
    const sessao = garantirSessao();
    await db.transaction('rw', db.itens_sap_cache, async () => {
      await db.itens_sap_cache.where('sessao_id').equals(sessao).delete();
      await db.itens_sap_cache.bulkAdd(itens.map(item => ({ ...item, sessao_id: sessao })));
    });
    setItensSap(itens);
  };

  const iniciarContagem = () => setEtapa(ETAPAS.SELECAO_LOCAL);

  const confirmarLocal = () => {
    if (!depositoAtual.trim()) {
      abrirAlerta('Atenção', 'Informe o Depósito/Almoxarifado de contagem.');
      return;
    }
    setEtapa(ETAPAS.BIPAGEM);
  };

  /** Recebe um ou vários códigos lidos (teclado, câmera ou drone) e enfileira no modal de quantidade. */
  const registrarCodigos = (codigos) => {
    const novos = codigos
      .map(c => validarLeitura(c, indice, depositoAtual, enderecoAtual))
      .filter(Boolean)
      .map(n => ({ ...n, chave: novoIdLeitura() }));
    if (novos.length === 0) return;

    if (novos.some(n => !n.itemEncontrado || n.localIncorreto)) playAlertSound();
    else playSucesso();

    setFilaColeta(prev => [...prev, ...novos]);
  };

  const descartarAtual = () => setFilaColeta(prev => prev.slice(1));

  const confirmarQuantidade = async (quantidade) => {
    const atual = filaColeta[0];
    if (!atual) return false;
    if (!(quantidade > 0)) {
      abrirAlerta('Quantidade Inválida', 'Por favor, informe uma quantidade física maior que zero.');
      return false;
    }

    const sessao = garantirSessao();
    const leitura = {
      id: novoIdLeitura(),
      sessao_id: sessao,
      material: atual.material,
      texto_breve: atual.texto_breve,
      endereco_lido: enderecoAtual.trim() || '-',
      deposito_lido: depositoAtual.trim() || '-',
      endereco_sap: atual.endereco_sap,
      deposito_sap: atual.deposito_sap,
      quantidade_fisica: quantidade,
      local_incorreto: atual.localIncorreto,
      item_encontrado: atual.itemEncontrado,
      cracha_leitura: operador.cracha,
      nome_operador: operador.nome,
      created_at: new Date().toISOString(),
      _status: 'pendente',
    };

    // Gravação local imediata (RN-005). Se falhar, a contagem não pode sumir em silêncio.
    try {
      await db.leituras_pendentes.add(leitura);
    } catch (errDb) {
      console.error('Falha ao salvar leitura no IndexedDB:', errDb);
      abrirAlerta('Erro ao salvar', 'Não foi possível gravar a contagem no aparelho. Verifique o espaço livre e tente novamente.');
      return false;
    }

    setLeituras(prev => [leitura, ...prev]);
    setFilaColeta(prev => prev.slice(1));
    playSalvo();
    aoRegistrar?.();
    return true;
  };

  /** Encerra o inventário atual. Só permite se tudo já foi enviado ao Supabase. */
  const novoInventario = async () => {
    const pendentes = await db.leituras_pendentes.where('_status').equals('pendente').count();
    if (pendentes > 0) {
      abrirAlerta('Leituras não enviadas', `Ainda há ${pendentes} leitura(s) aguardando envio. Conecte o aparelho à rede antes de encerrar o inventário.`);
      return;
    }
    if (sessaoId) {
      await db.transaction('rw', db.itens_sap_cache, db.leituras_pendentes, async () => {
        await db.itens_sap_cache.where('sessao_id').equals(sessaoId).delete();
        await db.leituras_pendentes.where('sessao_id').equals(sessaoId).delete();
      });
    }
    setSessaoId(null);
    setItensSap([]);
    setLeituras([]);
    setFilaColeta([]);
    setDepositoAtual('');
    setEnderecoAtual('');
    setEtapa(ETAPAS.IMPORT_SAP);
  };

  return {
    carregado,
    itensSap,
    leituras,
    etapa,
    setEtapa,
    depositoAtual,
    setDepositoAtual,
    enderecoAtual,
    setEnderecoAtual,
    coletaAtual: filaColeta[0] || null,
    restantesNaFila: Math.max(0, filaColeta.length - 1),
    importarItens,
    iniciarContagem,
    confirmarLocal,
    registrarCodigos,
    confirmarQuantidade,
    descartarAtual,
    novoInventario,
  };
}
