// src/app/App.jsx — Orquestrador: monta os módulos conforme a máquina de estados (app/estados.js).
import { useState } from 'react';
import Header from '../shared/components/Header';
import ModalDialogo from '../shared/components/ModalDialogo';
import StatusRede from '../shared/components/StatusRede';
import BannerAtualizacao from '../shared/components/BannerAtualizacao';
import { useDialogo } from '../shared/hooks/useDialogo';
import { useSyncManager } from '../modules/sync';
import { useOperador, LoginOperador, BarraOperador } from '../modules/auth';
import { ImportacaoSap } from '../modules/importacao-sap';
import { useInventario, SelecaoLocal, Bipagem, ModalQuantidade } from '../modules/inventario';
import { PainelConciliacao } from '../modules/conciliacao';
import { ETAPAS } from './estados';
import './App.css';

function App() {
  const { dialogo, fechar, abrirAlerta, abrirConfirmacao } = useDialogo();
  const { isOnline, pendingCount, syncNow, ultimoErro } = useSyncManager();
  const { operador, logado, entrar, sair } = useOperador();
  const inventario = useInventario({ operador, abrirAlerta, aoRegistrar: syncNow });
  const [mostrarConciliacao, setMostrarConciliacao] = useState(false);

  const fazerLogout = () => {
    abrirConfirmacao('Sair', 'Deseja encerrar a sessão do operador?', () => {
      sair();
      setMostrarConciliacao(false);
      inventario.setEtapa(ETAPAS.IMPORT_SAP);
    });
  };

  const confirmarNovoInventario = () => {
    abrirConfirmacao(
      'Encerrar inventário',
      'A base SAP e as contagens deste aparelho serão apagadas (as já enviadas continuam no Supabase). Deseja começar um novo inventário?',
      () => { inventario.novoInventario(); },
      'Encerrar',
    );
  };

  const renderizarEtapa = () => {
    switch (inventario.etapa) {
      case ETAPAS.SELECAO_LOCAL:
        return (
          <SelecaoLocal
            deposito={inventario.depositoAtual}
            endereco={inventario.enderecoAtual}
            aoMudarDeposito={inventario.setDepositoAtual}
            aoMudarEndereco={inventario.setEnderecoAtual}
            aoVoltar={() => inventario.setEtapa(ETAPAS.IMPORT_SAP)}
            aoConfirmar={inventario.confirmarLocal}
          />
        );
      case ETAPAS.BIPAGEM:
        return (
          <Bipagem
            deposito={inventario.depositoAtual}
            endereco={inventario.enderecoAtual}
            leituras={inventario.leituras}
            bloqueado={!!inventario.coletaAtual || dialogo.show}
            aoLerCodigos={inventario.registrarCodigos}
            aoAlterarLocal={() => inventario.setEtapa(ETAPAS.SELECAO_LOCAL)}
          />
        );
      default:
        return (
          <ImportacaoSap
            totalItens={inventario.itensSap.length}
            totalLeituras={inventario.leituras.length}
            aoImportar={inventario.importarItens}
            aoIniciar={inventario.iniciarContagem}
            aoNovoInventario={confirmarNovoInventario}
            abrirAlerta={abrirAlerta}
          />
        );
    }
  };

  return (
    <div className="container-fluid max-width-md p-2 p-sm-3 text-start">
      <Header />
      <BannerAtualizacao />
      <StatusRede isOnline={isOnline} pendingCount={pendingCount} ultimoErro={ultimoErro} aoSincronizar={syncNow} />

      <ModalDialogo dialogo={dialogo} aoFechar={fechar} />

      {inventario.coletaAtual && (
        <ModalQuantidade
          key={inventario.coletaAtual.chave}
          coleta={inventario.coletaAtual}
          restantes={inventario.restantesNaFila}
          aoConfirmar={inventario.confirmarQuantidade}
          aoCancelar={inventario.descartarAtual}
        />
      )}

      {!logado ? (
        <LoginOperador aoEntrar={entrar} abrirAlerta={abrirAlerta} />
      ) : (
        <>
          <BarraOperador
            operador={operador}
            mostrandoConciliacao={mostrarConciliacao}
            aoAlternarTela={() => setMostrarConciliacao(v => !v)}
            aoSair={fazerLogout}
          />

          {mostrarConciliacao ? (
            <PainelConciliacao itensSap={inventario.itensSap} leituras={inventario.leituras} abrirAlerta={abrirAlerta} />
          ) : (
            <div className="card shadow-sm border-0 p-3 mb-4">
              {inventario.carregado ? renderizarEtapa() : <div className="text-muted">Carregando dados do aparelho...</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
