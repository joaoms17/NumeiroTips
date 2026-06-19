/** Regras do jogo + sair. */
import { useGame } from '../../game/store';
import { friendById, APP_NAME } from '../../game/config';
import { AJUDAS } from '../../game/wheel';

/** Descrição completa de cada ajuda da roda (para as regras). */
const AJUDA_DESC: Record<string, string> = {
  rede: 'O teu jogador desse jogo nunca conta menos de 6.5, mesmo que jogue mal.',
  dois: 'Escolhes 2 jogadores nesse jogo e conta o que tiver melhor rating.',
  nenhuma: 'Calhou-te azar na roda — ficas sem ajuda nesse dia.',
  tira: 'Tiras 2 pontos a quem tiver escolhido um jogador à tua escolha — às cegas, não vês quem foi.',
  rouba: 'Roubas um jogador já escolhido por outro nesse jogo: passa a contar para ti e o dono fica sem ele.',
};

export function Regras() {
  const meId = useGame((s) => s.meId);
  const logout = useGame((s) => s.logout);
  const me = friendById(meId);

  return (
    <div className="rr-regras">
      <div className="rr-regras-card">
        <h3>Como se joga</h3>
        <ul>
          <li>Em cada jogo do dia escolhes <strong>1 jogador</strong>.</li>
          <li>Quando o jogo acaba, o <strong>rating</strong> real desse jogador soma à tua conta.</li>
          <li>Ganha quem tiver <strong>mais rating acumulado</strong> no Mundial.</li>
        </ul>
      </div>

      <div className="rr-regras-card">
        <h3>Regra do rotativo</h3>
        <ul>
          <li>Jogador <strong>único por jogo</strong>: quem escolhe primeiro trava-o.</li>
          <li>A <strong>ordem de escolha roda</strong> a cada jogo.</li>
          <li>Não podes repetir o <strong>mesmo jogador no mesmo dia</strong>.</li>
          <li>As escolhas <strong>fecham ao apito</strong> de cada jogo.</li>
          <li>Se o teu jogador não jogar (sem rating), levas <strong>0</strong> nesse jogo.</li>
          <li><strong>Se não escolheres</strong>, levas o rating do <strong>pior jogador do jogo</strong> — por isso escolhe sempre! 😬</li>
        </ul>
      </div>

      <div className="rr-regras-card">
        <h3>A roda do dia 🎡</h3>
        <p className="rr-regras-intro muted">
          Uma vez por dia rodas a roda e calha-te uma ajuda. Aplica-la num jogo
          que ainda não começou — só podes usar <strong>uma por dia</strong>.
        </p>
        <ul className="rr-ajudas-list">
          {AJUDAS.map((a) => (
            <li key={a.id} className="rr-ajuda-item">
              <span className="rr-ajuda-emoji">{a.emoji}</span>
              <span className="rr-ajuda-text">
                <strong>{a.name}</strong>
                <small>{AJUDA_DESC[a.id] ?? a.short}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rr-regras-card muted" style={{ fontSize: 13 }}>
        {APP_NAME} · jogos e resultados reais do Mundial 2026 (API-Football),
        com modo online para os 4 jogarem cada um no seu telemóvel.
      </div>

      {me && (
        <button className="rr-logout" onClick={logout}>
          Sair ({me.emoji} {me.name})
        </button>
      )}
    </div>
  );
}
