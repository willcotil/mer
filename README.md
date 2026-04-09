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

- **Canvas SVG interativo** com zoom (scroll/pinch), pan (espaço + arrastar / dois dedos) e rubber-band selection
- **Componentes MER completos:**
  - Entidade forte e fraca
  - Atributo simples, chave (PK), multivalorado, derivado e composto
  - Relacionamento e relacionamento identificador (fraco)
  - Agregação e Generalização/Especialização
- **Ligações** saindo do centro dos componentes, sempre atrás dos nós
- **Painel de propriedades** com edição de nome, tipo de dado, restrições (PK, FK, UK, NOT NULL, AI), aparência e cardinalidade
- **Dicionário de dados** gerado automaticamente a partir do diagrama, com opção de impressão
- **Snap à grade** configurável (8, 16, 24 ou 32 px) pelo centro dos objetos
- **Download do diagrama** como arquivo SVG
- **Salvar/Abrir** diagramas no formato `.mer` (JSON)
- **Histórico de undo/redo** com até 100 snapshots
- **Auto-save** no `localStorage` do navegador (com consentimento explícito)
- **Responsivo** — funciona em desktops e smartphones em modo paisagem
- **Tooltips explicativos** em cada componente do toolbox
- Botões de informação (ⓘ) com descrição de cada elemento MER

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| **HTML5 / SVG** | Estrutura e renderização do canvas |
| **JavaScript ES Modules** | Arquitetura modular sem bundler |
| **Tailwind CSS** (via CDN) | Estilização da interface |
| **CSS puro** | Estilos do canvas, responsividade e animações |
| **localStorage** | Persistência local do diagrama |

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
│   └── app.css         # Estilos do canvas, toolbox, modais e responsividade
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
