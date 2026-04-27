# MER Editor

> Editor de diagramas Entidade-Relacionamento diretamente no navegador — sem instalação, sem servidor, sem dependências.

![Licença](https://img.shields.io/badge/licença-GPL--3.0-blue)
![Tecnologia](https://img.shields.io/badge/tecnologia-Vanilla%20JS%20%2B%20SVG-informational)
![Status](https://img.shields.io/badge/status-ativo-brightgreen)

---

## Sobre o projeto

O **MER Editor** é uma ferramenta visual para modelagem de bancos de dados relacionais utilizando a notação de **Modelo Entidade-Relacionamento (MER)**. Ele roda inteiramente no navegador, sem necessidade de backend, login ou instalação de pacotes.

Ideal para estudantes, professores e desenvolvedores que precisam criar diagramas MER de forma rápida e intuitiva.

---

## Funcionalidades

### Canvas e interação
- **Canvas SVG interativo** com zoom (scroll/pinch), pan (espaço + arrastar / dois dedos) e rubber-band selection
- **Snap à grade** configurável (8, 16, 24 ou 32 px) pelo centro dos objetos
- **Histórico de undo/redo** com até 100 snapshots (`Ctrl+Z` / `Ctrl+Y`)
- **Copiar, colar e duplicar** elementos via `Ctrl+C`, `Ctrl+V`, `Ctrl+D`
- **Seleção múltipla** com `Shift+clique` ou arraste de área

### Componentes MER
- Entidade forte e fraca
- Atributo simples, chave (PK), multivalorado, derivado e composto
- Relacionamento e relacionamento identificador (fraco)
- Agregação e Generalização/Especialização
- **Ligações** com cardinalidade, participação total/parcial e waypoints editáveis

### Interface e produtividade
- **Painel de propriedades** com edição de nome, tipo de dado, restrições (PK, FK, UK, NOT NULL, AI), aparência e cardinalidade
- **Dicionário de dados** gerado automaticamente a partir do diagrama, com exportação CSV e impressão
- **Tooltips estilizados** em todos os botões, campos e itens do toolbox — com delay, posicionamento inteligente e seta direcional
- **Modal de atalhos de teclado** (`?` na toolbar) com referência completa de todos os atalhos
- **Salvar/Abrir** diagramas no formato `.mer` (JSON)
- **Auto-save** no `localStorage` do navegador (com consentimento explícito)

### Temas visuais
- **Modo noturno** — paleta escura completa, incluindo nós do canvas, arestas e painel de propriedades; persiste no `localStorage`; respeita `prefers-color-scheme` do sistema
- **Modo alto contraste** — fundo preto, texto branco, bordas amarelas, sem sombras; prioridade visual sobre o modo noturno; persiste no `localStorage`
- Os dois modos são **mutuamente exclusivos** — ativar um desativa o outro automaticamente

### Acessibilidade
- Landmarks semânticos (`<header>`, `<main>`, `<aside>`, `<footer>`)
- `aria-label` em todos os botões icon-only
- `aria-pressed` dinâmico nos toggles de tema
- `aria-hidden` e gerenciamento de foco no painel de propriedades (mobile)
- `<label for>` associado a todos os inputs do painel
- Fieldsets com legend para grupos de checkbox/radio
- Tabelas do dicionário com `<caption>`, `scope="col"` e siglas anotadas
- Focus trap no cookie banner; foco devolvido ao elemento de origem ao fechar modais
- Touch targets mínimos de 44×44px em todos os controles mobile

### Responsividade
- Layout adaptado para smartphones em modo paisagem (`max-width: 820px`)
- Toolbar em modo ícone-only no mobile
- Toolbox colapsado em strip vertical no mobile
- Painel de propriedades como overlay fixo no mobile, ativado por botão dedicado

---

## Atalhos de teclado

| Ação | Atalho |
|---|---|
| Desfazer | `Ctrl+Z` |
| Refazer | `Ctrl+Y` ou `Ctrl+Shift+Z` |
| Copiar | `Ctrl+C` |
| Colar | `Ctrl+V` |
| Duplicar | `Ctrl+D` |
| Selecionar tudo | `Ctrl+A` |
| Excluir seleção | `Delete` ou `Backspace` |
| Mover seleção | `↑ ↓ ← →` (1px) ou `Shift+↑↓←→` (10px) |
| Cancelar / desselecionar | `Esc` |
| Zoom + / − | `Ctrl+=` / `Ctrl+-` |
| Salvar | `Ctrl+S` |
| Abrir | `Ctrl+O` |
| Novo diagrama | `Ctrl+N` |
| Ver todos os atalhos | Botão `⌨` na toolbar |

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| **HTML5 / SVG** | Estrutura e renderização do canvas |
| **JavaScript ES Modules** | Arquitetura modular sem bundler |
| **Tailwind CSS** (via CDN) | Estilização da interface |
| **CSS puro** | Temas, canvas, responsividade e animações |
| **localStorage** | Persistência do diagrama e preferências de tema |

Nenhuma dependência de backend. Nenhum framework JavaScript. Nenhum processo de build.

---

## Como usar

### Pré-requisitos

O projeto usa **ES Modules** nativos, que requerem um servidor HTTP. O protocolo `file://` não funciona.

### Instalação

```bash
# Clone o repositório
git clone https://github.com/willcotil/mer.git
cd mer

# Suba um servidor HTTP local (qualquer um serve)
python3 -m http.server 8080
```

Acesse **http://localhost:8080** no navegador.

Alternativas ao Python:

```bash
# Node.js (npx, sem instalação)
npx serve .

# PHP
php -S localhost:8080
```

### Uso básico

| Ação | Como fazer |
|---|---|
| Adicionar componente | Arraste da barra lateral para o canvas, ou clique no item e depois no canvas |
| Mover | Arraste o componente |
| Conectar | Clique no círculo azul que aparece ao selecionar um nó |
| Editar propriedades | Clique no componente e use o painel à direita |
| Renomear | Duplo clique no componente |
| Selecionar múltiplos | Segure `Shift` + clique, ou arraste uma área vazia |
| Pan | Segure `Espaço` + arraste, ou dois dedos no touch |
| Zoom | Scroll do mouse / pinch no touch |
| Desfazer/Refazer | `Ctrl+Z` / `Ctrl+Y` |
| Excluir | `Delete` ou `Backspace` |

### Salvar e carregar

- **Salvar** — exporta um arquivo `.mer` (JSON) para o seu computador
- **Abrir** — carrega um arquivo `.mer` salvo anteriormente
- **Auto-save** — se você aceitar o uso de armazenamento local, o diagrama é salvo automaticamente a cada alteração e restaurado ao reabrir o editor

---

## Estrutura do projeto

```
mer/
├── index.html          # HTML principal + estrutura da UI
├── css/
│   └── app.css         # Estilos, temas (dark/high-contrast), responsividade
└── js/
    ├── main.js         # Bootstrap, wiring de botões e eventos globais
    ├── state.js        # Store central (MerState) com sistema de eventos
    ├── history.js      # Pilha de undo/redo
    ├── renderer.js     # Sincroniza estado → SVG (nodes e edges)
    ├── interaction.js  # FSM de interação: mouse, teclado e touch
    ├── toolbox.js      # Drag-and-drop, click-to-place e snap à grade
    ├── panel.js        # Painel de propriedades
    ├── shapes.js       # Renderização SVG de cada tipo de nó
    ├── edges.js        # Renderização SVG das ligações
    ├── dictionary.js   # Modal do dicionário de dados
    ├── serializer.js   # Salvar/carregar arquivos .mer
    ├── clipboard.js    # Copiar, colar e duplicar elementos
    ├── theme.js        # Modo noturno e alto contraste
    ├── tooltip.js      # Sistema global de tooltips
    ├── shortcuts.js    # Modal de atalhos de teclado
    ├── grid.js         # Lógica de snap à grade
    └── utils.js        # Utilitários: coordenadas, SVG, medição de texto
```

---

## Formato do arquivo `.mer`

Os diagramas são salvos como JSON com a seguinte estrutura:

```json
{
  "_type": "mer-editor-v1",
  "_version": "1.0",
  "_created": "2026-01-01T00:00:00.000Z",
  "nodes": [ ... ],
  "edges": [ ... ],
  "canvas": { "offsetX": 0, "offsetY": 0, "scale": 1 }
}
```

---

## Licença

Este projeto é distribuído sob a licença **GNU General Public License v3.0 (GPL-3.0)**.

Isso significa que você é livre para:

- ✅ **Usar** o software para qualquer finalidade
- ✅ **Estudar** como o programa funciona e adaptá-lo às suas necessidades
- ✅ **Redistribuir** cópias do software
- ✅ **Distribuir** versões modificadas

Desde que:

- 📋 Mantenha o aviso de licença e copyright
- 📋 Distribua o código-fonte de qualquer versão modificada
- 📋 Versões derivadas usem a mesma licença GPL-3.0

> Este programa é distribuído na esperança de que seja útil, mas **SEM NENHUMA GARANTIA**; sem mesmo a garantia implícita de **COMERCIALIZAÇÃO** ou **ADEQUAÇÃO A UM DETERMINADO FIM**.

Leia o texto completo da licença em: [https://www.gnu.org/licenses/gpl-3.0.html](https://www.gnu.org/licenses/gpl-3.0.html)

---

## Contribuindo

Contribuições são bem-vindas! Abra uma _issue_ para reportar bugs ou sugerir melhorias, ou envie um _pull request_ diretamente.

---

<p align="center">Feito com SVG puro e muito JavaScript — sem frameworks, sem complicação.</p>
