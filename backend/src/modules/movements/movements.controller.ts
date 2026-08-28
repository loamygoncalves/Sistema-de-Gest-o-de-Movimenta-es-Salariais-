import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AuthenticatedUser,
  CurrentUser,
  resolveAccessScope,
} from '../../common/decorators/current-user.decorator';
import { MovementsService } from './movements.service';
import { CreateMovementDto, MovementQueryDto, UpdateMovementDto } from './dto/movement.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  findAll(@Query() query: MovementQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.movementsService.findAll(query, resolveAccessScope(user));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.movementsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.movementsService.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.movementsService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.movementsService.remove(id);
  }

  @Post(':id/simulate')
  simulate(@Param('id') id: string) {
    return this.movementsService.simulate(id);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.movementsService.submit(id);
  }
}
