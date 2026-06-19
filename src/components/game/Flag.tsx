/**
 * Bandeira do país como IMAGEM local (public/flags/<cc>.svg).
 * Os emojis de bandeira não aparecem no Windows; e CDNs externos (flagcdn)
 * podem falhar/bloquear. Por isso servimos as SVGs nós mesmos (same-origin,
 * funciona offline). Sem `cc` ou se a imagem falhar, cai no emoji.
 */
import { useState } from 'react';

export function Flag({ cc, flag, name }: { cc?: string; flag?: string; name?: string }) {
  const [failed, setFailed] = useState(false);
  if (!cc || failed) return <span className="rr-flag-emoji">{flag ?? '🏳️'}</span>;
  return (
    <img
      className="rr-flag-img"
      src={`/flags/${cc}.svg`}
      alt={name ?? ''}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
