# SGMS no Google Apps Script

Reconstrução simplificada do Sistema de Gestão de Movimentações Salariais
para rodar inteiramente dentro do Google Workspace, sem servidor próprio:

- **Banco de dados** → uma planilha Google (uma aba por "tabela").
- **Backend** → funções Apps Script (`.gs`), expostas ao cliente via
  `google.script.run` (ver `Api.gs` e `docs/API_CONTRACT_APPS_SCRIPT.md`).
- **Frontend** → um Web App servido por `HtmlService` (SPA em HTML/CSS/JS
  puro, sem build step — `Index.html` + `Styles.html` + `Client_*.html`).
- **Identidade** → a conta Google de quem acessa (`Session.getActiveUser()`),
  casada com a aba `Usuarios` para saber o perfil (role) e o escopo de acesso
  (diretoria inteira para DIRETOR, uma seleção de centros de custo para
  GESTOR). Por cima disso, uma senha própria (camada extra — ver
  `PasswordAuth.gs`) precisa ser confirmada uma vez por sessão do navegador
  antes de liberar o resto do sistema.

Esta é uma reimplementação independente do sistema em `backend/` +
`frontend/` (NestJS + PostgreSQL + Next.js) — não compartilham dados nem
código. Use esta versão se o requisito é "rodar dentro do Workspace sem
infraestrutura própria"; use a outra se precisar de banco relacional real,
múltiplos ambientes, ou escala além do que uma planilha aguenta
confortavelmente (algumas dezenas de milhares de linhas por aba, no limite).

## Limitações assumidas (leia antes de adotar em produção)

- **Concorrência**: escritas usam `LockService` para serializar (evita
  corrupção), mas em uso simultâneo pesado uma planilha é mais lenta que um
  banco relacional. Adequado para a escala de uma equipe de RH/Remuneração,
  não para milhares de usuários simultâneos.
- **Consultas**: toda consulta varre a aba inteira em memória (sem índices).
  Os módulos de dashboard/histórico/posicionamento de mercado fazem esse
  scan a cada chamada — ok até a casa de milhares de linhas por aba.
- **Identidade**: `Session.getActiveUser().getEmail()` só é confiável
  quando o Web App roda dentro de um domínio Google Workspace (por isso
  `appsscript.json` fixa `"access": "DOMAIN"`). Contas @gmail.com pessoais
  não são suportadas por essa via.
- **Exportação**: em vez de gerar arquivos .xlsx/.pdf binários (como o
  backend em Node faz com exceljs/pdfkit), o histórico exporta criando uma
  Google Sheet nova e devolvendo o link de abertura e os links de
  `?format=xlsx`/`?format=pdf` do próprio Google Sheets.
- **Import de .xlsx**: exige o serviço avançado **Drive API** habilitado no
  projeto (ver passo 4 abaixo) — ele é usado só para converter o arquivo
  enviado em uma Google Sheet temporária, lida e depois apagada. Arquivos
  `.csv` não precisam disso (lidos direto com `Utilities.parseCsv`).

## Como implantar

### Opção A — clasp (recomendado)

```bash
npm install -g @google/clasp
clasp login
cd apps-script
clasp create --type webapp --title "SGMS" --rootDir .
clasp push
clasp deploy --description "SGMS v1"
```

`clasp create` gera um novo projeto Apps Script vinculado à sua conta e
escreve um `.clasp.json` local (não versionado — cada pessoa que implanta
tem o seu). Depois do primeiro `clasp push`:

1. Abra o projeto (`clasp open`).
2. No editor, selecione a função `setupSpreadsheet` e clique em **Executar**
   (autorize as permissões pedidas — Sheets, Drive, enviar e-mail em seu
   nome, e-mail do usuário). Isso cria a planilha "SGMS - Banco de Dados",
   grava seu ID nas Propriedades do Script, e cadastra você como usuário
   `ADMIN`.
3. Se for usar import de `.xlsx`: em **Serviços** (ícone `+` na barra
   lateral do editor), adicione o serviço avançado **Drive API**.
4. **Implantar → Nova implantação → Aplicativo da Web**. Configure
   "Executar como: usuário que acessa o app" e "Quem pode acessar:
   qualquer pessoa na [seu domínio Workspace]" (já é o padrão em
   `appsscript.json`, mas a UI de implantação pede para confirmar).
5. Abra a URL do Web App gerada — você já estará logado como ADMIN.
6. Para adicionar outras pessoas: prefira a tela **Usuários** do próprio
   sistema (Administração → Usuários), que já cuida do perfil e do escopo
   corretamente. Editando a planilha diretamente: aba **Usuarios**, uma linha
   por pessoa com `email`, `role`
   (`ADMIN`/`RH_REMUNERACAO`/`DIRETOR`/`FINANCEIRO`/`GESTOR`),
   `directorateId` (obrigatório para `DIRETOR` — pegue o `id` na aba
   **Diretorias**) ou `costCenterIds` (obrigatório para `GESTOR` — lista de
   ids da aba **CentrosCusto** separados por vírgula), `active` = `TRUE`.
   `passwordSalt`/`passwordHash` ficam vazios até a pessoa cadastrar a
   própria senha no primeiro acesso (tela exibida automaticamente).

### Opção B — copiar e colar manualmente

1. Vá em [script.google.com](https://script.google.com) → **Novo projeto**.
2. Renomeie para "SGMS".
3. Para cada arquivo em `apps-script/*.gs`: crie um arquivo de script com o
   mesmo nome (sem a extensão) e cole o conteúdo.
4. Para cada arquivo em `apps-script/*.html`: crie um arquivo HTML
   (**Arquivo → Novo → Html**) com o mesmo nome e cole o conteúdo.
5. Abra **Configurações do projeto** (ícone de engrenagem) → marque "Mostrar
   arquivo de manifesto `appsscript.json`" → cole o conteúdo de
   `apps-script/appsscript.json` por cima do gerado automaticamente.
6. Siga os passos 2–6 da Opção A acima (executar `setupSpreadsheet`,
   habilitar o serviço avançado Drive API se for usar `.xlsx`, implantar
   como Web App, cadastrar usuários).

## Estrutura dos arquivos

```
apps-script/
  appsscript.json          manifesto (timezone, escopos OAuth, Web App)
  Code.gs                  doGet() + helper include() para o HtmlService
  Db.gs                    SheetTable — CRUD genérico sobre uma aba
  Enums.gs                 enums do domínio (mesmos do backend NestJS)
  Setup.gs                 setupSpreadsheet() — cria abas + seed inicial + migração de layout
  Auth.gs                  identidade via conta Google + escopo de acesso
  PasswordAuth.gs          senha (camada extra sobre a conta Google)
  Notifications.gs         e-mail de notificação de nova solicitação (MailApp)
  Import.gs                parsing de CSV/XLSX enviado pelo navegador
  OrgService.gs             ) 
  UsersService.gs           |
  EmployeesService.gs       |  um arquivo por módulo de negócio,
  BudgetService.gs          |  espelhando backend/src/modules/*
  SimulatorService.gs       |
  MovementsService.gs       |
  ApprovalsService.gs       |
  HistoryService.gs         |
  SalaryStudiesService.gs   |
  DashboardService.gs      )
  Api.gs                   camada exposta ao cliente (google.script.run)
  Index.html               shell da SPA
  Styles.html               |  frontend HtmlService — ver
  Client_Core.html           |  docs/API_CONTRACT_APPS_SCRIPT.md
  Client_Views_*.html       )  para o contrato de cada api_*
```

## Onde estão as regras de negócio

As mesmas do sistema em NestJS, reimplementadas linha a linha:
`SimulatorService.gs` (impacto financeiro) e `ApprovalsService.gs`
(workflow Diretor → RH Remuneração → Financeiro) são os arquivos mais
importantes — comece por eles se for auditar o comportamento.
