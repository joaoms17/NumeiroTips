/**
 * Definições do motor + alertas + jogo responsável.
 */
import { useState } from 'react';
import { useStore } from '../state/store';
import { useAlerts, requestNotificationPermission } from '../hooks/useAlerts';
import type { SharpBook, TargetBook } from '../lib/types';
import { pct } from '../lib/format';
import { BUILD_ID, hardRefresh } from '../pwa';

export function Settings() {
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);

  const [alertsOn, setAlertsOn] = useState(false);
  const [alertEdge, setAlertEdge] = useState(0.03);
  const [sound, setSound] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );

  useAlerts({ enabled: alertsOn && permission === 'granted', minEdge: alertEdge, sound });

  const toggleBook = (book: TargetBook) => {
    const active = config.activeBooks.includes(book)
      ? config.activeBooks.filter((b) => b !== book)
      : [...config.activeBooks, book];
    setConfig({ activeBooks: active.length ? active : [book] });
  };

  const enableAlerts = async () => {
    const p = await requestNotificationPermission();
    setPermission(p);
    setAlertsOn(p === 'granted');
  };

  return (
    <>
    <div className="grid-2">
      <div className="panel">
        <div className="panel-h">Motor</div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label={`Limiar de edge · ${pct(config.edgeThreshold, 1)}`}>
            <input
              type="range"
              min={0}
              max={0.1}
              step={0.005}
              value={config.edgeThreshold}
              onChange={(e) => setConfig({ edgeThreshold: Number(e.target.value) })}
            />
          </Field>

          <Field label="Método de de-vig">
            <select
              value={config.devigMethod}
              onChange={(e) =>
                setConfig({ devigMethod: e.target.value as 'shin' | 'proportional' })
              }
            >
              <option value="shin">Shin (recomendado)</option>
              <option value="proportional">Proporcional (fallback)</option>
            </select>
          </Field>

          <Field label="Régua sharp">
            <select
              value={config.sharpSource}
              onChange={(e) => setConfig({ sharpSource: e.target.value as SharpBook })}
            >
              <option value="pinnacle">Pinnacle</option>
              <option value="betfair">Betfair Exchange</option>
            </select>
          </Field>

          <Field label={`Fração de Kelly · ${pct(config.kellyFraction, 0)}`}>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={config.kellyFraction}
              onChange={(e) => setConfig({ kellyFraction: Number(e.target.value) })}
            />
          </Field>

          <Field label={`Teto de stake · ${pct(config.stakeCap, 1)} da banca`}>
            <input
              type="range"
              min={0.01}
              max={0.1}
              step={0.005}
              value={config.stakeCap}
              onChange={(e) => setConfig({ stakeCap: Number(e.target.value) })}
            />
          </Field>

          <Field label="Banca (€)">
            <input
              type="number"
              min={0}
              step={10}
              value={config.bankroll}
              onChange={(e) => setConfig({ bankroll: Number(e.target.value) || 0 })}
            />
          </Field>

          <div>
            <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
              CASAS-ALVO ATIVAS
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {(['betclic', '1xbet'] as TargetBook[]).map((b) => (
                <label key={b} className="switch">
                  <input
                    type="checkbox"
                    checked={config.activeBooks.includes(b)}
                    onChange={() => toggleBook(b)}
                  />
                  <span className="track" />
                  <span>{b === 'betclic' ? 'Betclic' : '1xBet'}</span>
                </label>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Dica: valida o motor só com a Betclic (licenciada) antes de ativar a 1xBet.
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">Alertas (Fase 2)</div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <button className="btn primary" onClick={enableAlerts} disabled={alertsOn}>
              {permission === 'granted'
                ? alertsOn
                  ? 'Alertas ativos ✓'
                  : 'Ativar alertas'
                : 'Permitir notificações'}
            </button>
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Notificação do browser quando surge uma value bet ≥ {pct(alertEdge, 1)} que cumpre os
              filtros. O bot de Telegram corre server-side (Edge Function).
            </div>
          </div>

          <Field label={`Edge mínimo de alerta · ${pct(alertEdge, 1)}`}>
            <input
              type="range"
              min={0.02}
              max={0.1}
              step={0.005}
              value={alertEdge}
              onChange={(e) => setAlertEdge(Number(e.target.value))}
            />
          </Field>

          <label className="switch">
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
            <span className="track" />
            <span>Som no alerta</span>
          </label>

          <div className="note">
            <strong>Jogo responsável.</strong> Define limites e respeita-os. Os edges são pequenos e
            a variância é real. A app nunca aposta sozinha — confirmas sempre tu. Se sentires que o
            jogo deixou de ser controlado, procura apoio (SICAD / Linha Vida 1414).
          </div>
        </div>
      </div>
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-h">Versão</div>
      <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="mono muted">build {BUILD_ID}</span>
        <button className="btn primary" onClick={hardRefresh}>
          ⟳ Hard refresh (última versão)
        </button>
        <span className="muted" style={{ fontSize: 12 }}>
          Limpa a cache e o service worker e recarrega — usa se a app parecer desatualizada depois
          de um deploy.
        </span>
      </div>
    </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field" style={{ gap: 6 }}>
      <label>{label}</label>
      {children}
    </div>
  );
}
