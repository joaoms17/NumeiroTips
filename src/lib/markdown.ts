/**
 * Renderizador de Markdown mínimo e SEGURO (escapa HTML primeiro).
 * Suporta cabeçalhos (#), negrito (**), itálico (*) e listas (- / •).
 * Suficiente para a saída da IA — sem dependências.
 */
function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>');
}

export function mdToHtml(src: string): string {
  const esc = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .split('\n')
    .map((line) => {
      if (/^\s*-{3,}\s*$/.test(line)) return '<div class="md-hr"></div>';
      const h = line.match(/^\s*#{1,6}\s+(.*)$/);
      if (h) return `<div class="md-h">${inline(h[1])}</div>`;
      const li = line.match(/^\s*\d+\.\s+(.*)$/) || line.match(/^\s*[-•]\s+(.*)$/);
      if (li) return `<div class="md-li">${inline(li[1])}</div>`;
      if (line.trim() === '') return '<div class="md-sp"></div>';
      return `<div>${inline(line)}</div>`;
    })
    .join('');
}
