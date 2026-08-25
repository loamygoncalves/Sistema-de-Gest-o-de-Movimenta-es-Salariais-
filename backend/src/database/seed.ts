import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from './data-source';
import { Directorate } from '../modules/org/entities/directorate.entity';
import { Position } from '../modules/org/entities/position.entity';
import { CostCenter } from '../modules/org/entities/cost-center.entity';
import { User } from '../modules/users/entities/user.entity';
import { ChargeParameter } from '../modules/simulator/entities/charge-parameter.entity';
import { UserRole, ChargeValueType } from '../common/enums';

async function seed() {
  await AppDataSource.initialize();
  console.log('Conectado ao banco. Iniciando seed...');

  const directorateRepo = AppDataSource.getRepository(Directorate);
  const positionRepo = AppDataSource.getRepository(Position);
  const costCenterRepo = AppDataSource.getRepository(CostCenter);
  const userRepo = AppDataSource.getRepository(User);
  const chargeParamRepo = AppDataSource.getRepository(ChargeParameter);

  const directorateNames = [
    { name: 'Diretoria Comercial', annualBudget: 12_000_000 },
    { name: 'Diretoria de Operações', annualBudget: 18_000_000 },
    { name: 'Diretoria Financeira', annualBudget: 6_000_000 },
    { name: 'Diretoria de Tecnologia', annualBudget: 15_000_000 },
    { name: 'Diretoria de Gente e Gestão', annualBudget: 5_000_000 },
  ];
  const directorates: Directorate[] = [];
  for (const d of directorateNames) {
    let directorate = await directorateRepo.findOne({ where: { name: d.name } });
    if (!directorate) {
      directorate = await directorateRepo.save(directorateRepo.create(d));
    }
    directorates.push(directorate);
  }

  const positionNames = [
    'Analista I',
    'Analista II',
    'Analista III',
    'Especialista',
    'Coordenador',
    'Gerente',
    'Diretor',
  ];
  for (const name of positionNames) {
    const existing = await positionRepo.findOne({ where: { name } });
    if (!existing) await positionRepo.save(positionRepo.create({ name }));
  }

  const costCenterNames = [
    { code: 'CC-001', name: 'Comercial SP' },
    { code: 'CC-002', name: 'Operações RJ' },
    { code: 'CC-003', name: 'Financeiro Corporativo' },
    { code: 'CC-004', name: 'Tecnologia' },
  ];
  const costCenters: CostCenter[] = [];
  for (const cc of costCenterNames) {
    let costCenter = await costCenterRepo.findOne({ where: { code: cc.code } });
    if (!costCenter) costCenter = await costCenterRepo.save(costCenterRepo.create(cc));
    costCenters.push(costCenter);
  }

  const chargeParams = [
    { name: 'INSS_PATRONAL', label: 'INSS Patronal', valueType: ChargeValueType.PERCENTUAL, value: 20, isBenefit: false },
    { name: 'FGTS', label: 'FGTS', valueType: ChargeValueType.PERCENTUAL, value: 8, isBenefit: false },
    { name: 'FERIAS', label: 'Férias + 1/3', valueType: ChargeValueType.PERCENTUAL, value: 11.11, isBenefit: false },
    { name: 'DECIMO_TERCEIRO', label: '13º Salário', valueType: ChargeValueType.PERCENTUAL, value: 8.33, isBenefit: false },
    { name: 'BENEFICIOS', label: 'Benefícios (VR/VA/Saúde)', valueType: ChargeValueType.FIXO, value: 850, isBenefit: true },
  ];
  for (const cp of chargeParams) {
    const existing = await chargeParamRepo.findOne({ where: { name: cp.name } });
    if (!existing) await chargeParamRepo.save(chargeParamRepo.create(cp));
  }

  const usersToCreate = [
    { name: 'Administrador do Sistema', email: 'admin@empresa.com', role: UserRole.ADMIN },
    { name: 'Ana RH Remuneração', email: 'rh@empresa.com', role: UserRole.RH_REMUNERACAO },
    { name: 'Carlos Financeiro', email: 'financeiro@empresa.com', role: UserRole.FINANCEIRO },
    {
      name: 'Diretor Comercial',
      email: 'diretor.comercial@empresa.com',
      role: UserRole.DIRETOR,
      directorateId: directorates[0].id,
    },
  ];

  const defaultPassword = await bcrypt.hash('Senha@123', 10);
  for (const u of usersToCreate) {
    const existing = await userRepo.findOne({ where: { email: u.email } });
    if (!existing) {
      await userRepo.save(userRepo.create({ ...u, passwordHash: defaultPassword }));
    }
  }

  // GESTOR não usa directorateId — o escopo é uma seleção de centros de
  // custo (ver users.costCenters / resolveAccessScope). O usuário de exemplo
  // fica restrito ao mesmo centro de custo usado nos colaboradores de seed.
  const gestorEmail = 'gestor.comercial@empresa.com';
  let gestor = await userRepo.findOne({ where: { email: gestorEmail }, relations: ['costCenters'] });
  if (!gestor) {
    gestor = await userRepo.save(
      userRepo.create({
        name: 'Gestor Comercial',
        email: gestorEmail,
        role: UserRole.GESTOR,
        passwordHash: defaultPassword,
      }),
    );
  }
  if (!gestor.costCenters || gestor.costCenters.length === 0) {
    gestor.costCenters = [costCenters[0]];
    await userRepo.save(gestor);
  }

  console.log('Seed concluído. Usuários padrão (senha: Senha@123):');
  usersToCreate.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
  console.log(`  - ${gestor.email} (${gestor.role})`);

  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Erro ao executar seed:', error);
  process.exit(1);
});
