/**
 * Bandeira do país como IMAGEM (flagcdn) em vez de emoji.
 * Os emojis de bandeira não aparecem no Windows (a font não os traz), por isso
 * usamos imagens. Sem `cc` (ex.: equipas vindas da API), cai no emoji.
 */
export function Flag({ cc, flag, name }: { cc?: string; flag?: string; name?: string }) {
  if (!cc) return <span className="rr-flag-emoji">{flag ?? '🏳️'}</span>;
  return (
    <img
      className="rr-flag-img"
      src={`https://flagcdn.com/w40/${cc}.png`}
      srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
      alt={name ?? ''}
      loading="lazy"
    />
  );
}
