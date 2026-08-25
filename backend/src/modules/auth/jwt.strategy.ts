import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  role: string;
  directorateId: string | null;
  costCenterIds: string[] | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role as any,
      directorateId: payload.directorateId,
      costCenterIds: payload.costCenterIds ?? null,
    };
  }
}
