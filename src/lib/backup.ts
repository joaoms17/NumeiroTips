/**
 * Backup / restauro dos dados pessoais (apostas + config + banca).
 * Como tudo vive em localStorage, isto evita perder o histórico se limpares o
 * browser ou mudares de dispositivo (enquanto o Supabase não está ligado).
 */
import type { EngineConfig, TrackedBet } from './types';

export interface BackupFile {
  app: 'numeirotips';
  version: 1;
  exportedAt: string;
  config: EngineConfig;
  bets: TrackedBet[];
}

export function buildBackup(config: EngineConfig, bets: TrackedBet[]): BackupFile {
  return { app: 'numeirotips', version: 1, exportedAt: new Date().toISOString(), config, bets };
}

/** Descarrega um JSON com os dados. */
export function downloadBackup(config: EngineConfig, bets: TrackedBet[]): void {
  const blob = new Blob([JSON.stringify(buildBackup(config, bets), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `numeirotips-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ParsedBackup {
  config?: Partial<EngineConfig>;
  bets?: TrackedBet[];
}

/** Valida e normaliza um backup importado. Lança em formato inválido. */
export function parseBackup(json: string): ParsedBackup {
  const obj = JSON.parse(json) as Partial<BackupFile>;
  if (!obj || obj.app !== 'numeirotips') {
    throw new Error('Ficheiro não é um backup do NumeiroTips.');
  }
  if (obj.bets != null && !Array.isArray(obj.bets)) {
    throw new Error('Campo "bets" inválido.');
  }
  return { config: obj.config, bets: obj.bets };
}
