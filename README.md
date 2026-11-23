# Calendário de Plantio · Stardew Valley

Calendário para planejar plantações no Stardew Valley 1.6: escolha o que plantar
em cada dia da Fazenda, da Estufa ou da Ilha Gengibre e veja quando colher e
quanto ouro cada estação rende.

## Recursos

- **Calendário por estação**, com aniversários e festivais
- **Fazenda, Estufa e Ilha Gengibre**: na Estufa e na Ilha não há estações, então
  culturas que rebrotam **continuam produzindo nos anos seguintes até você
  arrancar a planta**. Use o botão "Arrancar depois" na colheita escolhida, e as
  colheitas anteriores continuam valendo.
- **Replantar sempre**: culturas de colheita única são replantadas no dia de cada
  colheita, enquanto der tempo de colher de novo
- **Fertilizantes**: qualidade (básico, qualidade, premium) e velocidade (Solo Foliar)
- **Lucro mínimo e esperado** por dia, estação e ano. O valor esperado considera a
  chance de qualidade (nível de cultivo + fertilizante) e os itens extras.
- **Profissões**: Lavrador (+10% no preço) e Agricultor (+10% de velocidade)
- **Tabela de culturas** com busca, filtro por estação e lucro por dia
- **Backup**: exporta/importa JSON (também aceita arquivos do planejador antigo)
- **Português e inglês**: seletor PT/EN no topo. O idioma inicial segue o do
  navegador e a escolha fica salva
- Atalhos: `←` `→` estação · `L` local · `C` culturas · `Esc` fecha

## Desenvolvimento

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # checa tipos e gera dist/
npm run preview    # serve dist/
```

Vite + TypeScript, sem framework.

```
src/
  data/      dados do jogo (culturas, fertilizantes, eventos), com nomes em pt e en
  domain/    regras do jogo, sem DOM: crescimento, qualidade, colheitas, lucro
  i18n/      textos da interface (pt.ts, en.ts) e idioma atual
  state/     estado da aplicação, persistência (localStorage) e ações
  ui/        interface: calendário, modal do dia, painel lateral
  styles/    tema (madeira/pergaminho/fonte pixel) e layout
public/      imagens e fontes
```

As datas são guardadas como **dias absolutos** (0 = 1 de Primavera, Ano 1), e
as colheitas são calculadas sob demanda. Por isso uma planta da Estufa pode
produzir para sempre sem gerar dados infinitos.

## Créditos

Calendário não oficial. Stardew Valley © ConcernedApe. Dados da
[Stardew Valley Wiki](https://stardewvalleywiki.com/). Ícones:
[Pixelarticons](https://pixelarticons.com/). Inspirado no
[crop_planner](https://github.com/exnil/crop_planner) (MIT).
