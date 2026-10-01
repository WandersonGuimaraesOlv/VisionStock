// src/modules/auth/useOperador.js — Sessão do operador identificado pelo crachá.
import { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabase';

const CHAVES = { cracha: 'usuario_cracha', nome: 'usuario_nome', admin: 'usuario_is_admin' };

const lerSessao = () => ({
  cracha: sessionStorage.getItem(CHAVES.cracha) || '',
  nome: sessionStorage.getItem(CHAVES.nome) || '',
  isAdmin: sessionStorage.getItem(CHAVES.admin) === 'true',
});

/**
 * Busca o crachá no Supabase (tabela "crachas").
 * Offline, com erro de rede ou crachá não cadastrado, entra como operador comum (nunca como admin).
 */
const buscarOperador = async (cracha) => {
  const padrao = { cracha, nome: `Operador ${cracha}`, isAdmin: false };
  if (!navigator.onLine || !supabase) return padrao;
  try {
    const { data, error } = await supabase
      .from('crachas')
      .select('id, nome_completo, admin')
      .eq('id', cracha)
      .maybeSingle();
    if (error) throw error;
    if (!data) return padrao;
    return { cracha, nome: data.nome_completo || padrao.nome, isAdmin: !!data.admin };
  } catch (err) {
    console.warn('Login em modo offline:', err);
    return padrao;
  }
};

export function useOperador() {
  const [operador, setOperador] = useState(lerSessao);

  useEffect(() => {
    if (operador.cracha) {
      sessionStorage.setItem(CHAVES.cracha, operador.cracha);
      sessionStorage.setItem(CHAVES.nome, operador.nome);
      sessionStorage.setItem(CHAVES.admin, String(operador.isAdmin));
    } else {
      Object.values(CHAVES).forEach(c => sessionStorage.removeItem(c));
    }
  }, [operador]);

  const entrar = async (crachaDigitado) => {
    const cracha = String(crachaDigitado || '').trim();
    if (!cracha) return false;
    setOperador(await buscarOperador(cracha));
    return true;
  };

  const sair = () => setOperador({ cracha: '', nome: '', isAdmin: false });

  return { operador, logado: !!operador.cracha, entrar, sair };
}
