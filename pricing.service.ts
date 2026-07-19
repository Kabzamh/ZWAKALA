import { Injectable } from '@nestjs/common';

export interface FareBreakdown {
  distanceKm: number;
  durationMin: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeMultiplier: number;
  bookingFee: number;
  subtotal: number;
}

/**
 * Straight-line (haversine) distance with a road-network fudge factor,
 * standing in for a real routing provider (Google Directions / Mapbox).
 * Swap `estimateRoute` for a real API call — everything downstream
 * (fare calc, ETA display) only depends on { distanceKm, durationMin }.
 */
@Injectable()
export class PricingService {
  private readonly ROAD_FACTOR = 1.35; // straight-line * factor ≈ real driving distance
  private readonly AVG_SPEED_KMH = 28; // city-driving average, for duration estimate

  estimateRoute(pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number) {
    const straightLineKm = this.haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const distanceKm = Math.max(0.5, straightLineKm * this.ROAD_FACTOR);
    const durationMin = Math.max(3, Math.round((distanceKm / this.AVG_SPEED_KMH) * 60));
    return { distanceKm: Number(distanceKm.toFixed(2)), durationMin };
  }

  calculateFare(
    rideType: { baseFare: number; perKmRate: number; perMinRate: number; bookingFee: number },
    distanceKm: number,
    durationMin: number,
    surgeMultiplier = 1.0,
  ): FareBreakdown {
    const distanceFare = distanceKm * Number(rideType.perKmRate);
    const timeFare = durationMin * Number(rideType.perMinRate);
    const baseFare = Number(rideType.baseFare);
    const bookingFee = Number(rideType.bookingFee);

    const subtotal = (baseFare + distanceFare + timeFare) * surgeMultiplier + bookingFee;

    return {
      distanceKm,
      durationMin,
      baseFare,
      distanceFare: Number(distanceFare.toFixed(2)),
      timeFare: Number(timeFare.toFixed(2)),
      surgeMultiplier,
      bookingFee,
      subtotal: Number(subtotal.toFixed(2)),
    };
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
