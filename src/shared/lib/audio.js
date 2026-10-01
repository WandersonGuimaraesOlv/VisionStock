// src/shared/lib/audio.js — Bipes de confirmação e alerta (Web Audio API).
// Um único AudioContext é reaproveitado: navegadores limitam quantos podem existir ao mesmo tempo.
let audioCtx = null;

const obterContexto = () => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx || audioCtx.state === 'closed') audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
};

export const playBeep = (frequencia = 800, duracao = 150) => {
  try {
    const ctx = obterContexto();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequencia;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duracao / 1000);
  } catch (e) {
    console.warn('AudioContext indisponível:', e);
  }
};

export const playAlertSound = () => {
  playBeep(400, 200);
  setTimeout(() => playBeep(300, 300), 200);
};

export const playSucesso = () => playBeep(900, 120);
export const playSalvo = () => playBeep(1200, 100);
