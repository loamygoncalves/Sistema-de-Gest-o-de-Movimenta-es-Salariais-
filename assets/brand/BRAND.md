# Identidade visual Beep — aplicada ao sistema (web app, não apresentação)

Fonte: skill oficial de apresentações da Beep (paleta, tipografia e logo).
Adaptação para produto/SaaS abaixo — as regras de "slide" (logo só na capa etc.)
não se aplicam a um app; aqui o logo fica fixo no topbar/sidebar como em
qualquer produto.

## Paleta (tokens)

| Papel | Hex | Uso no sistema |
|---|---|---|
| `--brand-teal` (verde principal) | `#00AFAA` | Cor primária: botões, links, ícones ativos, barra lateral ativa, gráficos (série principal) |
| `--brand-teal-light` | `#04D4CE` | Hover/gradiente, destaques |
| `--brand-teal-dark` | `#008E87` | Estados pressed, texto sobre fundo claro quando precisa de mais contraste |
| `--brand-orange` (laranja Beep) | `#FBA600` | Único laranja — acentos pontuais: badges de alerta/pendente, bullets, separadores, destaque numérico secundário. Nunca como fundo grande |
| `--brand-bg` (cinza claro) | `#F4F4F4` | Fundo padrão das páginas |
| `--brand-border` (cinza médio) | `#E5E5E5` | Bordas, divisores |
| `--brand-text` (cinza escuro) | `#4F5E69` | Texto de corpo, labels |
| `--brand-white` | `#FFFFFF` | Cards, superfícies |

Semânticas (não confundir com o acento da marca):
- Sucesso/Aprovado: um verde diferente do teal da marca é aceitável se precisar
  distinguir de "ação primária" (ex.: `#1F9D6C`) — ou reaproveitar o teal se só
  houver uma cor de sucesso no sistema.
- Alerta/Pendente: `#FBA600` (laranja Beep).
- Erro/Reprovado: vermelho neutro de sistema (ex.: `#DC2626`) — a marca não
  define um vermelho de erro; não usar o vermelho do ícone do logo para isso.

## Tipografia

Somente **Raleway** (Google Fonts:
`https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap`).
Pesos permitidos: Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700.
Fallback: `'Raleway', -apple-system, 'Segoe UI', sans-serif`.

## Logo

Dois arquivos em `assets/brand/` (copiados também para `frontend/public/`):
- `beep-logo-color.png` — versão colorida (teal + marca "beep!"), 1920×1080,
  fundo transparente/branco → usar em **fundos claros** (topbar branco,
  sidebar clara, tela de login).
- `beep-logo-white.png` — versão com o texto em branco (só o ícone colorido
  aparece), 3981×1169 (proporção 3.405:1) → usar em **fundos escuros/verdes**
  (ex.: sidebar se for pintada em teal, hero da tela de login).

No app: logo aparece no topbar (ou topo da sidebar) em todas as telas —
diferente de um deck, um produto mantém a marca visível o tempo todo. Manter
proporção original ao redimensionar (nunca esticar).

## Onde aplicar

- Cor primária de botões/links/estado ativo da navegação: `--brand-teal`.
- Badges de status: reaproveitar o mapeamento semântico acima, não o teal para
  tudo.
- Gráficos (dashboards, KPIs): série principal em teal, série secundária/meta
  em laranja Beep — mesma lógica do manual de gráficos da Beep (mês atual =
  teal, meta/orçado = laranja).
- Fundo de página: `--brand-bg` (#F4F4F4); cards em branco com borda
  `--brand-border`.
