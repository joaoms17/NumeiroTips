/**
 * Modelo in-play (análise de situações em jogo)
 * =============================================
 *
 * Pega nas expectativas de golos PRÉ-JOGO (λ casa, μ fora) e ajusta-as para o
 * TEMPO QUE FALTA, em função da situação atual — minuto, resultado e expulsões.
 * Captura "como as equipas reagem em certas situações":
 *
 *  - Tempo: só conta o que falta. λ_rem = λ · (90 − minuto)/90.
 *  - Resultado (game state): quem está a PERDER ataca mais (sobe a sua taxa);
 *    quem está a GANHAR gere o resultado (desce um pouco a sua taxa). O efeito
 *    é maior quanto mais perto do fim (urgência).
 *  - Expulsões: a equipa com menos um marca menos e sofre mais (multiplicadores
 *    compostos por cada vermelho).
 *
 * Com as taxas ajustadas, gera a matriz de golos do RESTO do jogo (Poisson +
 * Dixon-Coles) e deriva, já somando ao resultado atual, as probabilidades para:
 * resultado final (1X2), over/under da linha total, ambas marcam e próximo golo.
 *
 * Os parâmetros de reação têm defaults sensatos (ordem de grandeza da
 * literatura de in-play) e são todos ajustáveis — não há aqui "verdade
 * absoluta", é um modelo para estimar e comparar com a odd da casa.
 */
import { dixonColesMatrix, type ScoreMatrix } from './poisson';

export interface GameState {
  /** Minuto atual (0–90+). */
  minute: number;
  /** Golos da casa até agora. */
  homeGoals: number;
  /** Golos de fora até agora. */
  awayGoals: number;
  /** Vermelhos da casa (jogadores expulsos). */
  homeReds: number;
  /** Vermelhos de fora. */
  awayReds: number;
}

export interface InPlayParams {
  /** Aumento da taxa de ataque por golo de desvantagem (base). */
  trailingAttackPerGoal: number;
  /** Redução da taxa de ataque por golo de vantagem (gerir resultado). */
  leadingAttackPerGoal: number;
  /** Urgência extra de quem perde, escalada pelo tempo decorrido. */
  lateUrgency: number;
  /** Multiplicador da própria taxa de golo por cada vermelho próprio (<1). */
  redOwnScoring: number;
  /** Multiplicador da taxa de golo do adversário por cada vermelho nosso (>1). */
  redOppScoring: number;
  /** ρ de Dixon-Coles. */
  rho: number;
  /** Golos máximos extra a considerar na matriz do resto do jogo. */
  maxGoals: number;
}

export const DEFAULT_INPLAY_PARAMS: InPlayParams = {
  trailingAttackPerGoal: 0.1,
  leadingAttackPerGoal: -0.06,
  lateUrgency: 0.18,
  redOwnScoring: 0.74,
  redOppScoring: 1.25,
  rho: -0.1,
  maxGoals: 8,
};

export interface RemainingRates {
  lambdaRem: number; // golos esperados da casa no resto do jogo
  muRem: number; // golos esperados de fora no resto do jogo
}

/** Ajusta λ/μ para o resto do jogo segundo a situação. */
export function remainingRates(
  lambda: number,
  mu: number,
  state: GameState,
  params: InPlayParams = DEFAULT_INPLAY_PARAMS,
): RemainingRates {
  const minute = Math.max(0, Math.min(90, state.minute));
  const f = Math.max(0, (90 - minute) / 90);
  const timeFrac = minute / 90;

  let lh = lambda * f;
  let mu2 = mu * f;

  // game state: d = vantagem da casa
  const d = state.homeGoals - state.awayGoals;
  const kHome = Math.max(0, -d); // golos que a casa está atrás
  const kAway = Math.max(0, d); // golos que o fora está atrás

  // quem perde ataca mais (com urgência crescente); quem ganha abranda
  if (kHome > 0) {
    lh *= 1 + (params.trailingAttackPerGoal + params.lateUrgency * timeFrac) * Math.min(kHome, 3);
  } else if (d > 0) {
    lh *= 1 + params.leadingAttackPerGoal * Math.min(d, 3);
  }
  if (kAway > 0) {
    mu2 *= 1 + (params.trailingAttackPerGoal + params.lateUrgency * timeFrac) * Math.min(kAway, 3);
  } else if (d < 0) {
    mu2 *= 1 + params.leadingAttackPerGoal * Math.min(-d, 3);
  }

  // expulsões (compostas por cada vermelho)
  lh *= Math.pow(params.redOwnScoring, state.homeReds) * Math.pow(params.redOppScoring, state.awayReds);
  mu2 *= Math.pow(params.redOwnScoring, state.awayReds) * Math.pow(params.redOppScoring, state.homeReds);

  return { lambdaRem: Math.max(0, lh), muRem: Math.max(0, mu2) };
}

export interface LiveProbabilities {
  rates: RemainingRates;
  /** Resultado final (inclui o resultado atual). */
  home: number;
  draw: number;
  away: number;
  bttsYes: number;
  bttsNo: number;
  /** Próximo golo no resto do jogo. */
  nextGoalHome: number;
  nextGoalAway: number;
  nextGoalNone: number;
}

/** Probabilidades ao vivo a partir do estado de jogo e das expectativas base. */
export function liveProbabilities(
  lambda: number,
  mu: number,
  state: GameState,
  params: InPlayParams = DEFAULT_INPLAY_PARAMS,
): LiveProbabilities {
  const rates = remainingRates(lambda, mu, state, params);
  const sm = dixonColesMatrix(rates.lambdaRem, rates.muRem, params.rho, params.maxGoals);

  let home = 0;
  let draw = 0;
  let away = 0;
  let bttsYes = 0;
  const { matrix, maxGoals } = sm;
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      const p = matrix[x][y];
      const fh = state.homeGoals + x;
      const fa = state.awayGoals + y;
      if (fh > fa) home += p;
      else if (fh === fa) draw += p;
      else away += p;
      if (fh >= 1 && fa >= 1) bttsYes += p;
    }
  }

  // próximo golo: prob. de a casa marcar antes / fora marcar antes / nenhum
  // aproximação por taxas relativas no tempo restante (processo de Poisson):
  const total = rates.lambdaRem + rates.muRem;
  const pAnyGoal = 1 - Math.exp(-total);
  const nextGoalHome = total > 0 ? pAnyGoal * (rates.lambdaRem / total) : 0;
  const nextGoalAway = total > 0 ? pAnyGoal * (rates.muRem / total) : 0;
  const nextGoalNone = 1 - pAnyGoal;

  return {
    rates,
    home,
    draw,
    away,
    bttsYes,
    bttsNo: 1 - bttsYes,
    nextGoalHome,
    nextGoalAway,
    nextGoalNone,
  };
}

/** Over/Under da linha TOTAL do jogo, dado o resultado atual e a matriz do resto. */
export function liveTotals(
  sm: ScoreMatrix,
  state: GameState,
  line: number,
): { over: number; under: number; push: number } {
  const current = state.homeGoals + state.awayGoals;
  const isHalf = Math.abs(line - Math.round(line)) > 0.001;
  let over = 0;
  let under = 0;
  let push = 0;
  const { matrix, maxGoals } = sm;
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      const finalTotal = current + x + y;
      const p = matrix[x][y];
      if (isHalf) {
        if (finalTotal > line) over += p;
        else under += p;
      } else {
        if (finalTotal > line) over += p;
        else if (finalTotal < line) under += p;
        else push += p;
      }
    }
  }
  return { over, under, push };
}
