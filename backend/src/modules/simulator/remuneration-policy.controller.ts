import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { RemunerationPolicyService } from './remuneration-policy.service';
import { SaveRemunerationPolicyDto } from './dto/remuneration-policy.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('remuneration-policy')
export class RemunerationPolicyController {
  constructor(private readonly service: RemunerationPolicyService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Put()
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  save(@Body() dto: SaveRemunerationPolicyDto) {
    return this.service.save(dto);
  }
}
