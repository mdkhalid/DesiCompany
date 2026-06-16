import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'desicompany-dev-jwt-secret',
    });
  }

  async validate(payload: { sub: string; phone: string; role: string }) {
    const user = await this.userRepository.findOne({ where: { id: payload.sub } as any });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, phone: user.phone, role: user.role };
  }
}
