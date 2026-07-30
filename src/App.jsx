import React, { useState, useRef, useEffect, useMemo } from 'react';
import Header from './components/Header';
import Scanner from './components/Scanner';
import FilterControls from './components/FilterControls';
import ProcessadorDrone from './components/ProcessadorDrone';
import db from './db';
import { useSyncManager } from './hooks/useSyncManager';
import { supabase } from './supabase';
import './App.css';

// Auxiliar: Limpeza e normalização do código do Material / SKU
const limparCodigo = (codigo) => {
  if (!codigo) return '';
  const str = String(codigo).trim();
  // Se contiver apenas dígitos com zeros à esquerda, limpa os zeros mantendo pelo menos um dígito
  if (/^\d+$/.test(str)) {
    return str.replace(/^0+/, '') || '0';
  }
  return str.toUpperCase();
};

const playBeep = (frequencia = 800, duracao = 150) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequencia;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      audioCtx.close();
    }, duracao);
  } catch (e) {
    console.warn('AudioContext indisponível:', e);
  }
};

const playAlertSound = () => {
  playBeep(400, 200);
  setTimeout(() => playBeep(300, 300), 200);
};

function App() {
  // ATUALIZAÇÃO PWA SERVICE WORKER
  const [swRegistration, setSwRegistration] = useState(null);
  const [mostrarBannerAtualizacao, setMostrarBannerAtualizacao] = useState(false);

  // USUÁRIO E LOGIN
  const [crachaLogado, setCrachaLogado] = useState(() => sessionStorage.getItem('usuario_cracha') || '');
  const [nomeLogado, setNomeLogado] = useState(() => sessionStorage.getItem('usuario_nome') || '');
  const [inputCracha, setInputCracha] = useState('');
  const [carregandoLogin, setCarregandoLogin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('usuario_is_admin') === 'true');

  // OFFLINE-FIRST HOOK
  const { isOnline, pendingCount, syncNow } = useSyncManager();

  // BASE DE DADOS SAP "ETIQUETAS"
  const [itensSap, setItensSap] = useState(() => {
    const saved = sessionStorage.getItem('itens_sap');
    return saved ? JSON.parse(saved) : [];
  });

  // CONTAGENS FÍSICAS LIDAS
  const [leiturasGlobais, setLeiturasGlobais] = useState(() => {
    const saved = sessionStorage.getItem('leituras_almox');
    return saved ? JSON.parse(saved) : [];
  });

  // SESSÃO E ENDEREÇAMENTO
  const [sessaoId, setSessaoId] = useState(() => sessionStorage.getItem('sessao_id') || null);
  const [etapaInventario, setEtapaInventario] = useState('OCIOSO'); // OCIOSO | CONFIG | BIPANDO
  const [depositoAtual, setDepositoAtual] = useState('');
  const [enderecoAtual, setEnderecoAtual] = useState('');

  // ESTADOS DE ENTRADA
  const [codigoInput, setCodigoInput] = useState('');
  const [usandoCamera, setUsandoCamera] = useState(false);
  const [usandoDrone, setUsandoDrone] = useState(false);
  const [carregandoAcao, setCarregandoAcao] = useState(false);
  const [showConferencia, setShowConferencia] = useState(false);

  // MODAL DE COLETA DE QUANTIDADE (RN-002 & RN-003)
  const [modalColeta, setModalColeta] = useState({
    show: false,
    material: '',
    texto_breve: '',
    endereco_sap: '',
    deposito_sap: '',
    quantidadeFisica: '1',
    localIncorreto: false,
    itemEncontrado: true,
  });

  // MODAL GENÉRICO DE ALERTA / CONFIRMAÇÃO
  const [modal, setModal] = useState({
    show: false, title: '', message: '', type: 'alert', onConfirm: null, confirmText: 'Sim', cancelText: 'Cancelar'
  });

  // FILTROS DA CONCILIAÇÃO
  const [conferenciaFilters, setConferenciaFilters] = useState({ material: '', status: '', deposito: '' });
  const [conferenciaSort, setConferenciaSort] = useState({ field: 'material', order: 'asc' });
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 50;

  const inputCodigoRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputQtdRef = useRef(null);

  // ESCUTA ATUALIZAÇÃO DO SERVICE WORKER
  useEffect(() => {
    const lidarComAtualizacao = (event) => {
      setSwRegistration(event.detail);
      setMostrarBannerAtualizacao(true);
    };
    window.addEventListener('pwa-update-available', lidarComAtualizacao);
    return () => window.removeEventListener('pwa-update-available', lidarComAtualizacao);
  }, []);

  // PERSISTÊNCIA EM SESSION STORAGE
  useEffect(() => {
    sessionStorage.setItem('itens_sap', JSON.stringify(itensSap));
    sessionStorage.setItem('leituras_almox', JSON.stringify(leiturasGlobais));
    if (sessaoId) sessionStorage.setItem('sessao_id', sessaoId);
    else sessionStorage.removeItem('sessao_id');
  }, [itensSap, leiturasGlobais, sessaoId]);

  useEffect(() => {
    if (crachaLogado && nomeLogado) {
      sessionStorage.setItem('usuario_cracha', crachaLogado);
      sessionStorage.setItem('usuario_nome', nomeLogado);
      sessionStorage.setItem('usuario_is_admin', String(isAdmin));
    } else {
      sessionStorage.removeItem('usuario_cracha');
      sessionStorage.removeItem('usuario_nome');
      sessionStorage.removeItem('usuario_is_admin');
    }
  }, [crachaLogado, nomeLogado, isAdmin]);

  // AUTOFOCUS NO INPUT DE BIPA OU QUANTIDADE
  useEffect(() => {
    if (etapaInventario === 'BIPANDO' && !modalColeta.show && !modal.show && !showConferencia && !usandoCamera) {
      const timer = setTimeout(() => {
        if (inputCodigoRef.current) inputCodigoRef.current.focus();
      }, 150);
      return () => clearTimeout(timer);
    } else if (modalColeta.show) {
      const timer = setTimeout(() => {
        if (inputQtdRef.current) {
          inputQtdRef.current.focus();
          inputQtdRef.current.select();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [etapaInventario, modalColeta.show, modal.show, showConferencia, usandoCamera]);

  const aceitarAtualizacao = () => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setMostrarBannerAtualizacao(false);
  };

  const fecharModal = () => {
    setModal(prev => ({ ...prev, show: false }));
  };

  const abrirAlerta = (titulo, message) => setModal({ show: true, title: titulo, message: message, type: 'alert', onConfirm: null });
  const abrirConfirmacao = (titulo, message, acaoConfirmar, confirmText = 'Sim', cancelText = 'Cancelar') => {
    setModal({
      show: true, title: titulo, message: message, type: 'confirm', confirmText, cancelText,
      onConfirm: () => { acaoConfirmar(); fecharModal(); },
      onCancel: () => fecharModal()
    });
  };

  const fazerLogin = async () => {
    if (!inputCracha.trim()) { abrirAlerta('Atenção', 'Insira o número do seu crachá ou identificação.'); return; }
    setCarregandoLogin(true);
    try {
      if (!navigator.onLine) {
        setCrachaLogado(inputCracha.trim());
        setNomeLogado(`Operador (${inputCracha.trim()})`);
        setIsAdmin(true);
        return;
      }
      const { data, error } = await supabase.from('crachas').select('id, nome_completo, admin').eq('id', inputCracha.trim()).maybeSingle();
      if (data) {
        setCrachaLogado(inputCracha.trim());
        setNomeLogado(data.nome_completo || `Operador ${inputCracha.trim()}`);
        setIsAdmin(!!data.admin);
      } else {
        // Aceita operador dinâmico
        setCrachaLogado(inputCracha.trim());
        setNomeLogado(`Operador ${inputCracha.trim()}`);
        setIsAdmin(true);
      }
    } catch (err) {
      console.warn("Entrando em modo offline:", err);
      setCrachaLogado(inputCracha.trim());
      setNomeLogado(`Operador ${inputCracha.trim()}`);
      setIsAdmin(true);
    } finally {
      setCarregandoLogin(false);
    }
  };

  const fazerLogout = () => {
    abrirConfirmacao('Sair', 'Deseja encerrar a sessão do operador?', () => {
      setCrachaLogado(''); setNomeLogado(''); setInputCracha(''); setIsAdmin(false); setEtapaInventario('OCIOSO');
    });
  };

  const garantirSessao = async () => {
    if (sessaoId) return sessaoId;
    const novoId = `sessao-${Date.now()}`;
    setSessaoId(novoId);
    return novoId;
  };

  // PARSER DO CSV DA PLANILHA "ETIQUETAS"
  const importarPlanilhaSAP = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCarregandoAcao(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const linhas = text.split(/\r?\n/).filter(linha => linha.trim() !== '');
        if (linhas.length === 0) {
          abrirAlerta('Erro', 'O arquivo CSV selecionado está vazio.');
          setCarregandoAcao(false);
          return;
        }

        let idxCabecalho = 0;
        for (let i = 0; i < Math.min(10, linhas.length); i++) {
          const l = linhas[i].toLowerCase();
          if (l.includes('material') || l.includes('sku') || l.includes('código') || l.includes('codigo')) {
            idxCabecalho = i;
            break;
          }
        }

        const linhaCabecalho = linhas[idxCabecalho];
        let separator = ';';
        const numSemicolons = (linhaCabecalho.match(/;/g) || []).length;
        const numCommas = (linhaCabecalho.match(/,/g) || []).length;
        const numTabs = (linhaCabecalho.match(/\t/g) || []).length;

        if (numTabs > numSemicolons && numTabs > numCommas) separator = '\t';
        else if (numSemicolons >= numCommas) separator = ';';
        else separator = ',';

        const parseCSVLine = (line) => {
          let result = []; let current = ''; let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            let char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
            } else if (char === separator && !inQuotes) { result.push(current); current = ''; } else { current += char; }
          }
          result.push(current); return result.map(val => val.trim());
        };

        const headersLimpos = parseCSVLine(linhaCabecalho).map(h =>
          h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
        );

        const getIdx = (termos) => {
          for (let t of termos) {
            const idx = headersLimpos.indexOf(t);
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const idxMaterial = getIdx(['material', 'sku', 'codigo', 'codigomaterial', 'item']);
        const idxDescricao = getIdx(['textobrevematerial', 'textobreve', 'descricao', 'descricao', 'nomematerial']);
        const idxEndereco = getIdx(['endereco', 'enderecoraw', 'localizacao', 'posicao', 'gondola', 'prateleira']);
        const idxDeposito = getIdx(['deposito', 'depositocodigo', 'centro', 'almoxarifado', 'unidade']);
        const idxQtdSap = getIdx(['quantidadesap', 'qtdsap', 'saldosap', 'quantidade', 'saldo', 'qtd']);

        if (idxMaterial === -1) {
          abrirAlerta('Erro no Arquivo', 'A planilha precisa conter ao menos a coluna "Material" (ou SKU/Código).');
          setCarregandoAcao(false);
          return;
        }

        const itensProcessados = [];
        for (let i = idxCabecalho + 1; i < linhas.length; i++) {
          const colunas = parseCSVLine(linhas[i]);
          const matRaw = idxMaterial !== -1 ? colunas[idxMaterial] : null;
          if (!matRaw) continue;

          const materialClean = limparCodigo(matRaw);
          if (!materialClean) continue;

          const desc = idxDescricao !== -1 ? colunas[idxDescricao] : 'Sem descrição';
          const end = idxEndereco !== -1 ? colunas[idxEndereco] : '-';
          const dep = idxDeposito !== -1 ? colunas[idxDeposito] : 'Padrão';
          const qtdRaw = idxQtdSap !== -1 ? colunas[idxQtdSap] : '0';
          const qtdNum = parseFloat(String(qtdRaw).replace(/\./g, '').replace(',', '.')) || 0;

          itensProcessados.push({
            material: materialClean,
            texto_breve: desc,
            endereco: end || '-',
            deposito: dep || 'Padrão',
            quantidade_sap: qtdNum,
          });
        }

        const idSessao = await garantirSessao();
        setItensSap(itensProcessados);

        // Salva cache local no IndexedDB
        try {
          await db.itens_sap_cache.clear();
          await db.itens_sap_cache.bulkAdd(itensProcessados.map(item => ({
            ...item,
            sessao_id: idSessao
          })));
        } catch (dbErr) {
          console.warn("Erro ao salvar cache Dexie SAP:", dbErr);
        }

        abrirAlerta('Sucesso', `Planilha ETIQUETAS importada com sucesso! ${itensProcessados.length} materiais cadastrados.`);
      } catch (err) {
        console.error(err);
        abrirAlerta('Erro', 'Falha ao processar arquivo. Verifique se é um CSV válido.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
        setCarregandoAcao(false);
      }
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  // PROCESSAMENTO DA LEITURA (QR CODE / BARCODE / DIGITAÇÃO)
  const processarEntradaCodigo = (codigoBruto) => {
    if (!codigoBruto || !codigoBruto.trim()) return;
    const materialDigitado = limparCodigo(codigoBruto);
    setCodigoInput('');

    // Busca material na base ETIQUETAS importada
    const itemEncontrado = itensSap.find(item => item.material === materialDigitado);

    let localIncorreto = false;
    let enderecoSapStr = '-';
    let depositoSapStr = '-';
    let descStr = 'Item não cadastrado no SAP';

    if (itemEncontrado) {
      descStr = itemEncontrado.texto_breve;
      enderecoSapStr = itemEncontrado.endereco;
      depositoSapStr = itemEncontrado.deposito;

      // Validação de Endereçamento & Alertas de Setor (RN-003)
      const depIgual = !depositoAtual || itemEncontrado.deposito.toUpperCase() === depositoAtual.toUpperCase();
      const endIgual = !enderecoAtual || itemEncontrado.endereco.toUpperCase() === enderecoAtual.toUpperCase();

      if (!depIgual || !endIgual) {
        localIncorreto = true;
        playAlertSound();
      } else {
        playBeep(900, 120);
      }
    } else {
      playAlertSound();
    }

    // Abre Modal de Coleta de Quantidade Física (RN-002)
    setModalColeta({
      show: true,
      material: materialDigitado,
      texto_breve: descStr,
      endereco_sap: enderecoSapStr,
      deposito_sap: depositoSapStr,
      quantidadeFisica: '1',
      localIncorreto: localIncorreto,
      itemEncontrado: !!itemEncontrado,
    });
  };

  // CONFIRMAÇÃO DO INPUT DE QUANTIDADE FÍSICA
  const confirmarQuantidadeFisica = async () => {
    const qtdNum = parseFloat(String(modalColeta.quantidadeFisica).replace(',', '.')) || 0;
    if (qtdNum <= 0) {
      abrirAlerta('Quantidade Inválida', 'Por favor, informe uma quantidade física maior que zero.');
      return;
    }

    const idSessao = await garantirSessao();
    const novaLeitura = {
      id: `l-local-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sessao_id: idSessao,
      material: modalColeta.material,
      texto_breve: modalColeta.texto_breve,
      endereco_lido: enderecoAtual || modalColeta.endereco_sap || '-',
      deposito_lido: depositoAtual || modalColeta.deposito_sap || 'Padrão',
      endereco_sap: modalColeta.endereco_sap,
      deposito_sap: modalColeta.deposito_sap,
      quantidade_fisica: qtdNum,
      local_incorreto: modalColeta.localIncorreto,
      cracha_leitura: crachaLogado,
      nome_operador: nomeLogado,
      created_at: new Date().toISOString(),
      _status: 'pendente',
    };

    // Inserção instantânea sub-milissegundo no IndexedDB (RN-005)
    try {
      await db.leituras_pendentes.add(novaLeitura);
    } catch (errDb) {
      console.warn("Aviso ao salvar leitura no Dexie local:", errDb);
    }

    setLeiturasGlobais(prev => [novaLeitura, ...prev]);

    // Tenta sync remoto se online
    if (isOnline) {
      syncNow();
    }

    setModalColeta(prev => ({ ...prev, show: false }));
    playBeep(1200, 100);
  };

  // MOTOR DE CONCILIAÇÃO FÍSICA vs. SAP (RN-004)
  const itensConciliados = useMemo(() => {
    const mapaConciliacao = new Map();

    // 1. Inicializa com base SAP "ETIQUETAS"
    itensSap.forEach(item => {
      const chave = `${item.material}|${item.deposito}|${item.endereco}`;
      mapaConciliacao.set(chave, {
        material: item.material,
        texto_breve: item.texto_breve,
        deposito_sap: item.deposito,
        endereco_sap: item.endereco,
        quantidade_sap: item.quantidade_sap,
        quantidade_fisica: 0,
        deposito_lido: '-',
        endereco_lido: '-',
        teveLocalIncorreto: false,
        operadores: new Set(),
      });
    });

    // 2. Soma leituras físicas coletadas
    leiturasGlobais.forEach(lei => {
      let chaveEncontrada = null;

      // Tenta achar na base SAP
      for (let [chave, obj] of mapaConciliacao.entries()) {
        if (obj.material === lei.material) {
          chaveEncontrada = chave;
          break;
        }
      }

      if (chaveEncontrada) {
        const itemObj = mapaConciliacao.get(chaveEncontrada);
        itemObj.quantidade_fisica += lei.quantidade_fisica;
        itemObj.deposito_lido = lei.deposito_lido;
        itemObj.endereco_lido = lei.endereco_lido;
        if (lei.local_incorreto) itemObj.teveLocalIncorreto = true;
        if (lei.nome_operador) itemObj.operadores.add(lei.nome_operador);
      } else {
        // Item Sobra / Não cadastrado no SAP
        const chaveExtra = `${lei.material}|${lei.deposito_lido}|${lei.endereco_lido}`;
        if (mapaConciliacao.has(chaveExtra)) {
          const itemExtra = mapaConciliacao.get(chaveExtra);
          itemExtra.quantidade_fisica += lei.quantidade_fisica;
          if (lei.nome_operador) itemExtra.operadores.add(lei.nome_operador);
        } else {
          mapaConciliacao.set(chaveExtra, {
            material: lei.material,
            texto_breve: lei.texto_breve || 'Item Não Previsto no SAP',
            deposito_sap: '-',
            endereco_sap: '-',
            quantidade_sap: 0,
            quantidade_fisica: lei.quantidade_fisica,
            deposito_lido: lei.deposito_lido,
            endereco_lido: lei.endereco_lido,
            teveLocalIncorreto: lei.local_incorreto || false,
            operadores: new Set([lei.nome_operador || 'Operador']),
          });
        }
      }
    });

    // 3. Atribuição dos 4 Status
    return Array.from(mapaConciliacao.values()).map(item => {
      const diferenca = item.quantidade_fisica - item.quantidade_sap;
      let status = 'OK';

      if (item.quantidade_sap > 0 && item.quantidade_fisica === 0) {
        status = 'NAO_ENCONTRADO';
      } else if (item.teveLocalIncorreto) {
        status = 'LOCAL_INCORRETO';
      } else if (diferenca < 0) {
        status = 'FALTA';
      } else if (diferenca > 0) {
        status = 'SOBRA';
      }

      return {
        ...item,
        diferenca,
        status,
        operador_str: Array.from(item.operadores).join(', ') || '-',
      };
    });
  }, [itensSap, leiturasGlobais]);

  // FILTRAGEM E ORDENAÇÃO DOS RESULTADOS CONCILIADOS
  const itensConciliadosFiltrados = useMemo(() => {
    return itensConciliados.filter(item => {
      if (conferenciaFilters.material) {
        const bus = conferenciaFilters.material.toLowerCase();
        const matMatch = item.material.toLowerCase().includes(bus);
        const descMatch = item.texto_breve.toLowerCase().includes(bus);
        if (!matMatch && !descMatch) return false;
      }
      if (conferenciaFilters.status && item.status !== conferenciaFilters.status) {
        return false;
      }
      if (conferenciaFilters.deposito) {
        const depBus = conferenciaFilters.deposito.toLowerCase();
        const depSapMatch = item.deposito_sap.toLowerCase().includes(depBus);
        const depLidoMatch = item.deposito_lido.toLowerCase().includes(depBus);
        if (!depSapMatch && !depLidoMatch) return false;
      }
      return true;
    }).sort((a, b) => {
      const field = conferenciaSort.field;
      const asc = conferenciaSort.order === 'asc' ? 1 : -1;
      if (field === 'material') return a.material.localeCompare(b.material) * asc;
      if (field === 'status') return a.status.localeCompare(b.status) * asc;
      if (field === 'deposito') return a.deposito_sap.localeCompare(b.deposito_sap) * asc;
      return 0;
    });
  }, [itensConciliados, conferenciaFilters, conferenciaSort]);

  // ESTATÍSTICAS DO PAINEL
  const statsConciliacao = useMemo(() => {
    let totalOk = 0;
    let totalFalta = 0;
    let totalSobra = 0;
    let totalLocalIncorreto = 0;
    let totalNaoEncontrado = 0;

    itensConciliados.forEach(i => {
      if (i.status === 'OK') totalOk++;
      else if (i.status === 'FALTA') totalFalta++;
      else if (i.status === 'SOBRA') totalSobra++;
      else if (i.status === 'LOCAL_INCORRETO') totalLocalIncorreto++;
      else if (i.status === 'NAO_ENCONTRADO') totalNaoEncontrado++;
    });

    return {
      totalItens: itensConciliados.length,
      totalOk,
      totalFalta,
      totalSobra,
      totalLocalIncorreto,
      totalNaoEncontrado,
    };
  }, [itensConciliados]);

  // EXPORTAÇÃO CSV DE RELATÓRIO FINAL CONCILIADO
  const exportarCSVConciliacao = () => {
    if (itensConciliados.length === 0) {
      abrirAlerta('Atenção', 'Não há dados de conciliação para exportar.');
      return;
    }

    let csvContent = '\uFEFF'; // BOM UTF-8 para suporte nativo no Excel
    csvContent += 'Material;Texto Breve Material;Depósito SAP;Endereço SAP;Qtd SAP;Qtd Física Contada;Diferença;Status Conciliação;Depósito Lido;Endereço Lido;Operador\n';

    itensConciliados.forEach(item => {
      const statusFormatado = item.status === 'OK' ? 'OK' :
        item.status === 'FALTA' ? 'Divergência (Falta)' :
          item.status === 'SOBRA' ? 'Divergência (Sobra)' :
            item.status === 'LOCAL_INCORRETO' ? 'Local Incorreto' : 'Não Encontrado';

      const linha = [
        `"${item.material}"`,
        `"${item.texto_breve.replace(/"/g, '""')}"`,
        `"${item.deposito_sap}"`,
        `"${item.endereco_sap}"`,
        item.quantidade_sap,
        item.quantidade_fisica,
        item.diferenca,
        `"${statusFormatado}"`,
        `"${item.deposito_lido}"`,
        `"${item.endereco_lido}"`,
        `"${item.operador_str}"`,
      ].join(';');

      csvContent += linha + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `conciliacao_almox_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // INÍCIO DO FLUXO OPERACIONAL DE BIPAGEM
  const iniciarInventario = () => {
    if (!crachaLogado) {
      abrirAlerta('Atenção', 'Faça login com seu crachá para iniciar a contagem.');
      return;
    }
    setEtapaInventario('CONFIG');
  };

  const confirmarConfiguracaoLocal = () => {
    if (!depositoAtual.trim()) {
      abrirAlerta('Atenção', 'Informe o Depósito/Almoxarifado de contagem.');
      return;
    }
    setEtapaInventario('BIPANDO');
  };

  return (
    <div className="container-fluid max-width-md p-2 p-sm-3 text-start">
      <Header />

      {/* BANNER DE ATUALIZAÇÃO DO SERVICE WORKER */}
      {mostrarBannerAtualizacao && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center mb-3 shadow-sm" role="alert">
          <div>
            <strong>Nova versão disponível!</strong> Atualize a aplicação para obter as últimas melhorias.
          </div>
          <button className="btn btn-sm btn-dark" onClick={aceitarAtualizacao}>
            Atualizar Agora
          </button>
        </div>
      )}

      {/* BANNER DE INDICADOR DE REDE E QUEUE OFFLINE */}
      <div className="d-flex justify-content-between align-items-center mb-3 px-2">
        <span className={`badge ${isOnline ? 'bg-success' : 'bg-danger'} p-2`}>
          {isOnline ? '🌐 Online (Conectado)' : '⚡ Offline (IndexedDB Ativo)'}
        </span>
        {pendingCount > 0 && (
          <span className="badge bg-warning text-dark p-2" onClick={syncNow} style={{ cursor: 'pointer' }}>
            🔄 {pendingCount} leituras pendentes de envio
          </span>
        )}
      </div>

      {/* MODAL GENÉRICO */}
      {modal.show && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">{modal.title}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={fecharModal}></button>
              </div>
              <div className="modal-body fs-6 py-4">
                {modal.message}
              </div>
              <div className="modal-footer">
                {modal.type === 'confirm' ? (
                  <>
                    <button className="btn btn-outline-secondary" onClick={() => modal.onCancel ? modal.onCancel() : fecharModal()}>
                      {modal.cancelText}
                    </button>
                    <button className="btn btn-danger fw-bold" onClick={modal.onConfirm}>
                      {modal.confirmText}
                    </button>
                  </>
                ) : (
                  <button className="btn btn-dark w-100 fw-bold" onClick={fecharModal}>
                    OK
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COLETA DE QUANTIDADE FÍSICA (RN-002 & RN-003) */}
      {modalColeta.show && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-2 border-danger">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  📦 Confirmar Quantidade Física
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModalColeta(prev => ({ ...prev, show: false }))}></button>
              </div>
              <div className="modal-body py-3">
                {/* ALERTA DE LOCAL INCORRETO (RN-003) */}
                {modalColeta.localIncorreto && (
                  <div className="alert alert-warning border-warning d-flex align-items-center gap-2 mb-3">
                    <span className="fs-3">⚠️</span>
                    <div>
                      <strong className="d-block text-dark">Alerta: Local Divergente do SAP!</strong>
                      <small className="text-muted">
                        Cadastrado no SAP em: <strong>Depósito {modalColeta.deposito_sap} | Endereço {modalColeta.endereco_sap}</strong>
                      </small>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-light rounded border mb-3">
                  <div className="small text-uppercase text-secondary fw-bold">Material (SKU)</div>
                  <div className="fs-4 fw-bold text-dark font-monospace">{modalColeta.material}</div>
                  <div className="fw-medium text-secondary mt-1">{modalColeta.texto_breve}</div>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label fw-bold text-dark fs-6">
                    Quantidade Física Contada:
                  </label>
                  <input
                    ref={inputQtdRef}
                    type="number"
                    step="any"
                    className="form-control form-control-lg text-center fw-bold fs-3 border-danger"
                    value={modalColeta.quantidadeFisica}
                    onChange={(e) => setModalColeta(prev => ({ ...prev, quantidadeFisica: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        confirmarQuantidadeFisica();
                      }
                    }}
                  />
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button className="btn btn-outline-secondary w-48" onClick={() => setModalColeta(prev => ({ ...prev, show: false }))}>
                  Cancelar
                </button>
                <button className="btn btn-danger fw-bold fs-5 w-48 py-2" onClick={confirmarQuantidadeFisica}>
                  ✓ Salvar Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TELA DE LOGIN DE OPERADOR */}
      {!crachaLogado ? (
        <div className="card shadow-sm border-0 my-4 p-4 text-center">
          <h3 className="fw-bold mb-2">Identificação do Operador</h3>
          <p className="text-muted small mb-4">Digite o número do seu crachá ou identificação de almoxarifado para iniciar.</p>

          <div className="form-group mb-3 max-width-xs mx-auto">
            <input
              type="text"
              className="form-control form-control-lg text-center font-monospace"
              placeholder="Número do Crachá..."
              value={inputCracha}
              onChange={(e) => setInputCracha(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fazerLogin()}
            />
          </div>

          <button className="btn btn-danger btn-lg w-100 fw-bold shadow-sm" onClick={fazerLogin} disabled={carregandoLogin}>
            {carregandoLogin ? 'A validar...' : 'Entrar no Sistema'}
          </button>
        </div>
      ) : (
        <>
          {/* BARRA DE CABEÇALHO DO OPERADOR */}
          <div className="card border-0 bg-dark text-white p-3 mb-3 d-flex flex-row align-items-center justify-content-between shadow-sm">
            <div>
              <small className="text-secondary d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Operador Logado</small>
              <strong className="fs-6 text-light">{nomeLogado} ({crachaLogado})</strong>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-light btn-sm" onClick={() => setShowConferencia(!showConferencia)}>
                {showConferencia ? '📋 Contagem' : '📊 Painel Conciliação'}
              </button>
              <button className="btn btn-outline-danger btn-sm" onClick={fazerLogout}>
                Sair
              </button>
            </div>
          </div>

          {/* PAINEL DE CONFERÊNCIA & CONCILIAÇÃO (ADMIN / GESTOR) */}
          {showConferencia ? (
            <div className="card shadow-sm border-0 p-3 mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold m-0">📊 Conciliação de Estoque Física vs. SAP</h4>
                <button className="btn btn-success fw-bold btn-sm d-flex align-items-center gap-1" onClick={exportarCSVConciliacao}>
                  📥 Exportar Relatório CSV
                </button>
              </div>

              {/* DASHBOARD DE CARDS ESTATÍSTICOS */}
              <div className="row g-2 mb-3">
                <div className="col-6 col-md-2">
                  <div className="p-2 border rounded bg-light text-center">
                    <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>Total Itens</small>
                    <strong className="fs-5">{statsConciliacao.totalItens}</strong>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="p-2 border rounded bg-success bg-opacity-10 border-success text-center">
                    <small className="text-success d-block text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>OK (Sem Divergência)</small>
                    <strong className="fs-5 text-success">{statsConciliacao.totalOk}</strong>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="p-2 border rounded bg-danger bg-opacity-10 border-danger text-center">
                    <small className="text-danger d-block text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>Divergência Falta</small>
                    <strong className="fs-5 text-danger">{statsConciliacao.totalFalta}</strong>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="p-2 border rounded bg-warning bg-opacity-10 border-warning text-center">
                    <small className="text-warning d-block text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>Divergência Sobra</small>
                    <strong className="fs-5 text-warning">{statsConciliacao.totalSobra}</strong>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="p-2 border rounded bg-info bg-opacity-10 border-info text-center">
                    <small className="text-info d-block text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>Local Incorreto</small>
                    <strong className="fs-5 text-info">{statsConciliacao.totalLocalIncorreto}</strong>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="p-2 border rounded bg-secondary bg-opacity-10 border-secondary text-center">
                    <small className="text-secondary d-block text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>Não Encontrado</small>
                    <strong className="fs-5 text-secondary">{statsConciliacao.totalNaoEncontrado}</strong>
                  </div>
                </div>
              </div>

              {/* CONTROLES DE FILTRO */}
              <FilterControls
                filters={conferenciaFilters}
                onFilterChange={setConferenciaFilters}
                onResetFilters={() => setConferenciaFilters({ material: '', status: '', deposito: '' })}
                sortConfig={conferenciaSort}
                onSortChange={setConferenciaSort}
                itemsCount={itensConciliadosFiltrados.length}
              />

              {/* TABELA CONCILIADA */}
              <div className="table-responsive">
                <table className="table table-hover table-striped border align-middle text-start" style={{ fontSize: '0.85rem' }}>
                  <thead className="table-dark">
                    <tr>
                      <th>Status</th>
                      <th>Material (SKU)</th>
                      <th>Descrição</th>
                      <th>Depósito SAP</th>
                      <th>Endereço SAP</th>
                      <th>Qtd SAP</th>
                      <th>Qtd Física</th>
                      <th>Diferença</th>
                      <th>Endereço Lido</th>
                      <th>Operador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensConciliadosFiltrados.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA).map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          {item.status === 'OK' && <span className="badge bg-success">OK</span>}
                          {item.status === 'FALTA' && <span className="badge bg-danger">Divergência (Falta)</span>}
                          {item.status === 'SOBRA' && <span className="badge bg-warning text-dark">Divergência (Sobra)</span>}
                          {item.status === 'LOCAL_INCORRETO' && <span className="badge bg-info text-dark">Local Incorreto</span>}
                          {item.status === 'NAO_ENCONTRADO' && <span className="badge bg-secondary">Não Encontrado</span>}
                        </td>
                        <td className="fw-bold font-monospace">{item.material}</td>
                        <td>{item.texto_breve}</td>
                        <td>{item.deposito_sap}</td>
                        <td>{item.endereco_sap}</td>
                        <td className="fw-bold">{item.quantidade_sap}</td>
                        <td className="fw-bold text-primary">{item.quantidade_fisica}</td>
                        <td className={`fw-bold ${item.diferenca < 0 ? 'text-danger' : item.diferenca > 0 ? 'text-warning' : 'text-success'}`}>
                          {item.diferenca > 0 ? `+${item.diferenca}` : item.diferenca}
                        </td>
                        <td>{item.endereco_lido} ({item.deposito_lido})</td>
                        <td>{item.operador_str}</td>
                      </tr>
                    ))}
                    {itensConciliadosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan="10" className="text-center py-4 text-muted">
                          Nenhum registro de conciliação encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* FLUXO OPERACIONAL DE INVENTÁRIO (MOBILE-FIRST) */
            <div className="card shadow-sm border-0 p-3 mb-4">

              {/* PASSO 1: OCIOSO / IMPORTAÇÃO PLANILHA "ETIQUETAS" */}
              {etapaInventario === 'OCIOSO' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="fw-bold m-0">1. Base de Referência (SAP)</h4>
                    <span className="badge bg-secondary">{itensSap.length} materiais carregados</span>
                  </div>

                  <div className="p-3 bg-light rounded border mb-3">
                    <p className="small text-muted mb-2">
                      Importe a planilha <strong>"ETIQUETAS"</strong> (.CSV) exportada do SAP ERP com as colunas:
                      <code>Material</code>, <code>Texto breve material</code>, <code>Endereço</code>, <code>Depósito</code> e <code>Quantidade SAP</code>.
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      className="form-control"
                      onChange={importarPlanilhaSAP}
                    />
                  </div>

                  <button className="btn btn-danger btn-lg w-100 fw-bold shadow-sm py-3" onClick={iniciarInventario}>
                    🚀 Iniciar Contagem Física
                  </button>
                </div>
              )}

              {/* PASSO 2: CONFIGURAÇÃO DE LOCALIZAÇÃO */}
              {etapaInventario === 'CONFIG' && (
                <div>
                  <h4 className="fw-bold mb-3">2. Selecionar Local de Contagem</h4>
                  <div className="form-group mb-3">
                    <label className="form-label fw-bold">Depósito / Almoxarifado:</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Ex: Depósito 1001 / Almoxarifado Central"
                      value={depositoAtual}
                      onChange={(e) => setDepositoAtual(e.target.value)}
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label className="form-label fw-bold">Endereço / Prateleira / Gôndola (Opcional):</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Ex: Corredor A - P12"
                      value={enderecoAtual}
                      onChange={(e) => setEnderecoAtual(e.target.value)}
                    />
                  </div>

                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary w-50" onClick={() => setEtapaInventario('OCIOSO')}>
                      Voltar
                    </button>
                    <button className="btn btn-danger fw-bold w-50 py-3 fs-5" onClick={confirmarConfiguracaoLocal}>
                      Ir para Bipagem →
                    </button>
                  </div>
                </div>
              )}

              {/* PASSO 3: BIPAGEM E LEITURA DE MATERIAIS */}
              {etapaInventario === 'BIPANDO' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h4 className="fw-bold m-0">3. Bipagem de Materiais</h4>
                      <small className="text-muted">
                        Local: <strong>{depositoAtual || 'Geral'}</strong> | {enderecoAtual ? `Endereço: ${enderecoAtual}` : 'Sem Endereço'}
                      </small>
                    </div>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setEtapaInventario('CONFIG')}>
                      Alterar Local
                    </button>
                  </div>

                  {/* SCANNER CAMERA OU DRONE */}
                  {usandoCamera && (
                    <Scanner
                      aoLerCodigo={(codigoLido) => {
                        setUsandoCamera(false);
                        processarEntradaCodigo(codigoLido);
                      }}
                      aoCancelar={() => setUsandoCamera(false)}
                    />
                  )}

                  {usandoDrone && (
                    <ProcessadorDrone
                      aoConcluirLeituras={(codigosEmMassa) => {
                        setUsandoDrone(false);
                        codigosEmMassa.forEach(c => processarEntradaCodigo(c));
                      }}
                      aoFechar={() => setUsandoDrone(false)}
                    />
                  )}

                  {/* INPUT DE BIPAGEM DIRETA / LEITOR USB */}
                  {!usandoCamera && !usandoDrone && (
                    <div className="my-3">
                      <div className="input-group input-group-lg mb-3">
                        <input
                          ref={inputCodigoRef}
                          type="text"
                          className="form-control font-monospace border-danger border-2 fs-4 text-uppercase"
                          placeholder="Bipe o código do Material (SKU)..."
                          value={codigoInput}
                          onChange={(e) => setCodigoInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              processarEntradaCodigo(codigoInput);
                            }
                          }}
                        />
                        <button className="btn btn-danger fw-bold px-4" onClick={() => processarEntradaCodigo(codigoInput)}>
                          Bipar
                        </button>
                      </div>

                      <div className="d-flex gap-2">
                        <button className="btn btn-outline-dark w-50 py-2 d-flex align-items-center justify-content-center gap-2" onClick={() => setUsandoCamera(true)}>
                          📷 Usar Câmera
                        </button>
                        <button className="btn btn-outline-primary w-50 py-2 d-flex align-items-center justify-content-center gap-2" onClick={() => setUsandoDrone(true)}>
                          🛸 Vídeo de Drone (IA)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* LISTA RESUMIDA DAS ÚLTIMAS LEITURAS */}
                  <div className="mt-4">
                    <h6 className="fw-bold text-muted text-uppercase mb-2" style={{ fontSize: '0.75rem' }}>
                      Últimas Contagens Registradas ({leiturasGlobais.length})
                    </h6>
                    <div className="list-group">
                      {leiturasGlobais.slice(0, 5).map((l, idx) => (
                        <div key={idx} className="list-group-item d-flex justify-content-between align-items-center py-2">
                          <div>
                            <strong className="font-monospace text-dark d-block">{l.material}</strong>
                            <small className="text-muted d-block">{l.texto_breve}</small>
                          </div>
                          <div className="text-end">
                            <span className="badge bg-primary fs-6">Qtd: {l.quantidade_fisica}</span>
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>
                              {l.endereco_lido}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;