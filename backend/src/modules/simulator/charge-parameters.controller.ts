import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { ChargeParametersService } from './charge-parameters.service';
import { CreateChargeParameterDto, UpdateChargeParameterDto } from './dto/charge-parameter.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('charge-parameters')
export class ChargeParametersController {
  constructor(private readonly service: ChargeParametersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  create(@Body() dto: CreateChargeParameterDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  update(@Param('id') id: string, @Body() dto: UpdateChargeParameterDto) {
    return this.service.update(id, dto);
  }
}
