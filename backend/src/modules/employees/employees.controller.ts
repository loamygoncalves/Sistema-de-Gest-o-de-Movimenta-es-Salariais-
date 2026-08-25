import {
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

  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  @UseInterceptors(FileInterceptor('file'))
  importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.importFromExcel(file.buffer, file.originalname, user.id);
  }
}
