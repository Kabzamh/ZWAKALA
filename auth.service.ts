import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface OtpEntry {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

/**
 * OTP store is in-memory for this skeleton — fine for a single instance / dev.
 * Swap for Redis (with TTL) before running more than one API replica, and
 * swap the console.log delivery for a real SMS provider (Twilio, etc.).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');
  private otpStore = new Map<string, OtpEntry>();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async requestOtp(phone: string) {
    const otpId = randomUUID();
    const code = randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    this.otpStore.set(otpId, { phone, code, expiresAt, attempts: 0 });
    // Dev-mode "delivery": logged instead of sent via SMS.
    this.logger.log(`OTP for ${phone}: ${code} (otpId=${otpId})`);

    return { otpId, expiresInSeconds: 300 };
  }

  /**
   * DEV-ONLY convenience: returns the OTP code for a given otpId instead of
   * making a human tail server logs or a test script parse stdout. Disabled
   * outside development so it can never ship as a real vulnerability.
   */
  peekOtpForDev(otpId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Not available in production');
    }
    const entry = this.otpStore.get(otpId);
    if (!entry) throw new BadRequestException('Unknown or expired otpId');
    return { code: entry.code, phone: entry.phone };
  }

  async verifyOtp(otpId: string, code: string) {
    const entry = this.otpStore.get(otpId);
    if (!entry) throw new UnauthorizedException('OTP not found or already used');
    if (Date.now() > entry.expiresAt) {
      this.otpStore.delete(otpId);
      throw new UnauthorizedException('OTP expired');
    }
    entry.attempts += 1;
    if (entry.attempts > 5) {
      this.otpStore.delete(otpId);
      throw new UnauthorizedException('Too many attempts, request a new code');
    }
    if (entry.code !== code) throw new UnauthorizedException('Incorrect code');

    this.otpStore.delete(otpId);

    const user = await this.prisma.user.upsert({
      where: { phone: entry.phone },
      update: {},
      create: { phone: entry.phone, fullName: 'New User', role: 'PASSENGER' },
      include: { driverProfile: true },
    });

    return this.issueTokens(user.id, user.role);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; role: 'PASSENGER' | 'DRIVER' | 'ADMIN' };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    return this.issueTokens(user.id, user.role);
  }

  private async issueTokens(userId: string, role: 'PASSENGER' | 'DRIVER' | 'ADMIN') {
    const payload = { sub: userId, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') || '1h',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d',
      }),
    ]);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: user.id,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        ratingAvg: user.ratingAvg,
      },
    };
  }
}
