# Backend — API NestJS

## Stack

NestJS 10, TypeORM 0.3, PostgreSQL, Passport JWT, class-validator,
ExcelJS (import/export), PDFKit (export PDF), Swagger.

## Comandos

```bash
npm install
cp .env.example .env
npm run migration:run   # cria o schema no Postgres
npm run seed             # popula diretorias, cargos, encargos e usuários de exemplo
npm run start:dev        # http://localhost:3001/api
```

- Documentação OpenAPI: `http://localhost:3001/docs`
- Contrato de rotas: `../docs/API_CONTRACT.md`

## Estrutura

Cada módulo de negócio vive em `src/modules/<nome>` com `entities/`,
`dto/`, `<nome>.service.ts`, `<nome>.controller.ts` e `<nome>.module.ts`.
Regras transversais (guards de JWT/RBAC, decorators, enums, utilitários de
Excel/PDF) ficam em `src/common`.

O módulo mais importante do domínio é `simulator/simulator.service.ts`
(cálculo de impacto financeiro de cada movimentação) e
`approvals/approvals.service.ts` (motor do workflow Diretor → RH
Remuneração → Financeiro).
