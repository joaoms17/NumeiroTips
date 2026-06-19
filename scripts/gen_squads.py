#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera src/game/squads2026.ts a partir de data/convocados_mundial_2026.csv
(convocatórias reais do Mundial 2026).

O CSV tem colunas: numero,jogador,selecao  (sem posição).
As posições são atribuídas pela ORDEM em que vêm listados (convenção FIFA:
guarda-redes primeiro, depois defesas, médios e avançados).

Uso:  python scripts/gen_squads.py
"""
import csv
import json
import os

CSV = os.path.join("data", "convocados_mundial_2026.csv")
OUT = os.path.join("src", "game", "squads2026.ts")

# Nome da seleção (como no CSV) -> código de 3 letras usado na app.
CODE = {
    "África do Sul": "RSA", "Alemanha": "GER", "Arábia Saudita": "KSA",
    "Argélia": "ALG", "Argentina": "ARG", "Austrália": "AUS", "Áustria": "AUT",
    "Bélgica": "BEL", "Bósnia": "BIH", "Brasil": "BRA", "Cabo Verde": "CPV",
    "Canadá": "CAN", "Catar": "QAT", "Colômbia": "COL", "Coreia do Sul": "KOR",
    "Costa do Marfim": "CIV", "Croácia": "CRO", "Curaçao": "CUW", "Egito": "EGY",
    "Equador": "ECU", "Espanha": "ESP", "Escócia": "SCO", "Estados Unidos": "USA",
    "França": "FRA", "Gana": "GHA", "Haiti": "HAI", "Holanda": "NED",
    "Inglaterra": "ENG", "Irã": "IRN", "Iraque": "IRQ", "Japão": "JPN",
    "Jordânia": "JOR", "Marrocos": "MAR", "México": "MEX", "Noruega": "NOR",
    "Nova Zelândia": "NZL", "Panamá": "PAN", "Paraguai": "PAR", "Portugal": "POR",
    "RD Congo": "COD", "República Tcheca": "CZE", "Senegal": "SEN",
    "Suécia": "SWE", "Suíça": "SUI", "Tunísia": "TUN", "Turquia": "TUR",
    "Uruguai": "URU", "Uzbequistão": "UZB",
}


def pos_for(i: int) -> str:
    """Posição pela ordem na lista (aprox.): 3 GR, 8 DEF, 8 MED, resto AVA."""
    if i < 3:
        return "GR"
    if i < 11:
        return "DEF"
    if i < 19:
        return "MED"
    return "AVA"


def main():
    teams = {}  # code -> list of (numero, nome, pos)
    seen = {}   # code -> set de nomes já vistos (evitar duplicados na convocatória)
    order = []  # preserva ordem de aparição das seleções
    dupes = 0
    with open(CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sel = row["selecao"].strip()
            code = CODE.get(sel)
            if not code:
                print(f"  ⚠️  seleção sem código (ignorada): {sel}")
                continue
            if code not in teams:
                teams[code] = []
                seen[code] = set()
                order.append(code)
            nome = row["jogador"].strip()
            nkey = nome.lower()
            if nkey in seen[code]:
                print(f"  ⚠️  duplicado removido: {nome} ({code})")
                dupes += 1
                continue
            seen[code].add(nkey)
            idx = len(teams[code])
            num_raw = (row["numero"] or "").strip()
            teams[code].append((num_raw, nome, pos_for(idx)))

    lines = []
    lines.append("/**")
    lines.append(" * Plantéis REAIS do Mundial 2026 (convocatórias FIFA).")
    lines.append(" * GERADO por scripts/gen_squads.py a partir de")
    lines.append(" * data/convocados_mundial_2026.csv — NÃO editar à mão.")
    lines.append(" * Posições atribuídas pela ordem da lista (GR→DEF→MED→AVA), indicativas.")
    lines.append(" */")
    lines.append("import type { Footballer, Pos } from './types';")
    lines.append("")
    lines.append("function pl(team: string, name: string, pos: Pos, number: number): Footballer {")
    lines.append("  return { id: `${team}-${number}`, name, team, pos, number };")
    lines.append("}")
    lines.append("")
    lines.append("export const EXTRA_SQUADS: Record<string, Footballer[]> = {")

    total = 0
    for code in order:
        used = set()
        lines.append(f"  {code}: [")
        for num_raw, nome, pos in teams[code]:
            try:
                num = int(num_raw)
            except ValueError:
                num = 0
            # garantir número único dentro da equipa (id = code-number)
            while num in used or num == 0:
                num = (max(used) + 1) if used else 1
            used.add(num)
            nome_js = json.dumps(nome, ensure_ascii=False)
            lines.append(f"    pl('{code}', {nome_js}, '{pos}', {num}),")
            total += 1
        lines.append("  ],")
    lines.append("};")
    lines.append("")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Escrito {OUT}")
    print(f"Seleções: {len(order)}")
    print(f"Jogadores: {total}")
    print(f"Duplicados removidos: {dupes}")


if __name__ == "__main__":
    main()
