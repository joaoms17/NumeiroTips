/** Regras do jogo + sair. */
import { useGame } from '../../game/store';
import { friendById, APP_NAME } from '../../game/config';

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
        </ul>
      </div>

      <div className="rr-regras-card muted" style={{ fontSize: 13 }}>
        {APP_NAME} · dados de exemplo do Mundial 2026. Em breve: jogos e ratings reais (API-Football)
        e modo online para os 4 jogarem cada um no seu telemóvel.
      </div>

      {me && (
        <button className="rr-logout" onClick={logout}>
          Sair ({me.emoji} {me.name})
        </button>
      )}
    </div>
  );
}
