import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
  resolveAccessScope,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, EmployeeQueryDto, UpdateEmployeeDto } from './dto/employee.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Query() query: EmployeeQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.findAll(query, resolveAccessScope(user));
  }

  @Get('comparison')
  compareWithBudget(
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.compareWithBudget(
      parseInt(year, 10) || new Date().getFullYear(),
      month ? parseInt(month, 10) : undefined,
      resolveAccessScope(user),
    );
  }

  @Get('import/:batchId')
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  getImportBatch(@Param('batchId') batchId: string) {
    return this.employeesService.getImportBatch(batchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }

  /**
   * Fechamento mensal da folha: `year`/`month` identificam o mês que está
   * sendo fechado — além de atualizar o salário vivo de cada colaborador
   * (`employees.current_salary`, como sempre), grava um snapshot desse mês
   * em `payroll_snapshots` para que relatórios de meses passados usem o
   * valor congelado daquele mês, não o salário atual re-lido depois.
   */
  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  @UseInterceptors(FileInterceptor('file'))
  importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);
    if (!parsedYear || !parsedMonth || parsedMonth < 1 || parsedMonth > 12) {
      throw new BadRequestException('Informe o ano e o mês de referência do fechamento (year, month).');
    }
    return this.employeesService.importFromExcel(
      file.buffer,
      file.originalname,
      user.id,
      parsedYear,
      parsedMonth,
    );
  }
}
