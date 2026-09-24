import { describe, expect, it } from "vitest";
import { bookingAmount, computePlatformFee, consultantPayout, feeBpsToPercent } from "../../src/server/payments/fees";

describe("platform fee", () => {
  it("applies basis points", () => {
    expect(computePlatformFee(25_000, 1000)).toBe(2_500); // 10% of $250
    expect(computePlatformFee(150_000, 1250)).toBe(18_750);
  });
  it("rounds half-up to the cent", () => {
    expect(computePlatformFee(999, 1000)).toBe(100); // 99.9 → 100
    expect(computePlatformFee(1_005, 500)).toBe(50); // 50.25 → 50
    expect(computePlatformFee(1_010, 500)).toBe(51); // 50.5 → 51
  });
  it("is safe at the edges", () => {
    expect(computePlatformFee(0, 1000)).toBe(0);
    expect(computePlatformFee(-100, 1000)).toBe(0);
    expect(computePlatformFee(10_000, -5)).toBe(0);
    expect(computePlatformFee(10_000, Number.NaN)).toBe(0);
    expect(computePlatformFee(10_000, 99_999)).toBe(5_000); // clamped to 50%
  });
  it("derives payout and subscription percent", () => {
    expect(consultantPayout(25_000, 2_500)).toBe(22_500);
    expect(feeBpsToPercent(1000)).toBe(10);
    expect(feeBpsToPercent(1250)).toBe(12.5);
  });
  it("prices hourly bookings by quantity and everything else flat", () => {
    expect(bookingAmount("hourly", 30_000, 2)).toBe(60_000);
    expect(bookingAmount("fixed", 25_000, 3)).toBe(25_000);
    expect(bookingAmount("recurring", 150_000)).toBe(150_000);
  });
});
