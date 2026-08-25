import { BadRequestException, Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MovementType } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
  resolveAccessScope,
} from '../../common/decorators/current-user.decorator';
import { Employee } from '../employees/entities/employee.entity';
import { SimulatorService } from './simulator.service';
import { SimulatePreviewDto } from './dto/simulate-preview.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('simulator')
export class SimulatorController {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly simulatorService: SimulatorService,
  ) {}

  /**
   * Simulação rápida (Módulo 4) — Gestor/Diretor testa o impacto de uma
   * promoção/mérito para um de seus colaboradores antes de abrir a
   * solicitação de fato. Não persiste nada (nem MovementRequest, nem
   * MovementSimulation) — é só uma prévia.
   */
  @Post('preview')
  async preview(@Body() dto: SimulatePreviewDto, @CurrentUser() user: AuthenticatedUser) {
    if (dto.type !== MovementType.PROMOCAO && dto.type !== MovementType.MERITO) {
      throw new BadRequestException('Simulação rápida só está disponível para promoção ou mérito');
    }

    const employee = await this.employeeRepo.findOne({ where: { id: dto.employeeId } });
    if (!employee) throw new BadRequestException('Colaborador não encontrado');

    const scope = resolveAccessScope(user);
    if (scope.directorateId && employee.directorateId !== scope.directorateId) {
      throw new ForbiddenException('Colaborador fora da sua diretoria');
    }
    if (scope.costCenterIds && !scope.costCenterIds.includes(employee.costCenterId ?? '')) {
      throw new ForbiddenException('Colaborador fora dos seus centros de custo');
    }

    if (dto.type === MovementType.PROMOCAO) {
      if (!dto.newPositionId) throw new BadRequestException('Novo cargo é obrigatório');
      if (dto.newSalary === undefined) throw new BadRequestException('Novo salário é obrigatório');
      if (dto.newSalary < employee.currentSalary) {
        throw new BadRequestException(
          'Promoção não pode ter novo salário inferior ao salário atual do colaborador',
        );
      }
      return this.simulatorService.simulate({
        type: MovementType.PROMOCAO,
        directorateId: employee.directorateId,
        costCenterId: employee.costCenterId,
        currentSalary: employee.currentSalary,
        newSalary: dto.newSalary,
        effectiveDate: dto.effectiveDate,
      });
    }

    if (dto.newSalary === undefined) throw new BadRequestException('Novo salário é obrigatório');
    if (dto.newSalary <= employee.currentSalary) {
      throw new BadRequestException('Mérito precisa ter novo salário maior que o salário atual do colaborador');
    }
    const meritPercentage = ((dto.newSalary - employee.currentSalary) / employee.currentSalary) * 100;
    return this.simulatorService.simulate({
      type: MovementType.MERITO,
      directorateId: employee.directorateId,
      costCenterId: employee.costCenterId,
      currentSalary: employee.currentSalary,
      meritPercentage: Number(meritPercentage.toFixed(2)),
      effectiveDate: dto.effectiveDate,
    });
  }
}
