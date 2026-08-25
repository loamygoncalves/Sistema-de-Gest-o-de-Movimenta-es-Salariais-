import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !user.active) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const costCenterIds = user.costCenters?.map((c) => c.id) ?? null;

    const payload: JwtPayload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      directorateId: user.directorateId ?? null,
      costCenterIds,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        directorateId: user.directorateId ?? null,
        costCenterIds,
      },
    };
  }
}
