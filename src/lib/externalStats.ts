/**
 * Links para estatísticas externas das equipas / jogo.
 * Abrem pesquisa nos sites de stats mais úteis (PT e internacionais) para
 * complementares a análise do jogo selecionado.
 */
export interface StatLink {
  name: string;
  url: string;
}

const q = (s: string) => encodeURIComponent(s.trim());

/** Links de pesquisa para um confronto (home vs away). */
export function matchExternalLinks(home: string, away: string): StatLink[] {
  const match = `${home} ${away}`;
  return [
    { name: 'FlashScore', url: `https://www.flashscore.com/search/?q=${q(match)}` },
    { name: 'ZeroZero', url: `https://www.zerozero.pt/pesquisa.php?q=${q(match)}` },
    { name: 'SofaScore', url: `https://www.sofascore.com/search?q=${q(match)}` },
    {
      name: 'Google',
      url: `https://www.google.com/search?q=${q(`${match} estatísticas`)}`,
    },
  ];
}

/** Links de estatísticas de uma equipa. */
export function teamExternalLinks(team: string): StatLink[] {
  return [
    { name: 'ZeroZero', url: `https://www.zerozero.pt/pesquisa.php?q=${q(team)}` },
    { name: 'FlashScore', url: `https://www.flashscore.com/search/?q=${q(team)}` },
    { name: 'SofaScore', url: `https://www.sofascore.com/search?q=${q(team)}` },
    { name: 'FBref', url: `https://fbref.com/en/search/search.fcgi?search=${q(team)}` },
  ];
}
