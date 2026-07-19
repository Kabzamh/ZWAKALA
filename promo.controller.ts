import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PromoService } from './promo.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';

@ApiTags('Promo')
@ApiBearerAuth()
@Controller('promo')
export class PromoController {
  constructor(private promo: PromoService) {}

  @Post('validate')
  validate(@Body() dto: ValidatePromoDto) {
    return this.promo.validate(dto.code);
  }
}
