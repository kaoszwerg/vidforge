import { describe, it, expect } from "vitest";
import { formatBitrate, formatBytes, formatDuration, formatFps } from "./format";

describe("formatBytes", () => {
  it("renders whole bytes below 1 KB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("renders KB/MB/GB/TB with one decimal", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1_500_000)).toBe("1.4 MB");
    expect(formatBytes(1_500_000_000)).toBe("1.4 GB");
    expect(formatBytes(1_500_000_000_000)).toBe("1.4 TB");
  });

  it("never steps past TB", () => {
    expect(formatBytes(1_500_000_000_000_000)).toBe("1364.2 TB");
  });

  it("falls back to 0 B for a negative or non-finite input", () => {
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(Infinity)).toBe("0 B");
  });
});

describe("formatDuration", () => {
  it("renders m:ss under an hour", () => {
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(599)).toBe("9:59");
  });

  it("renders h:mm:ss at an hour or more", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(7325)).toBe("2:02:05");
  });

  it("rounds to the nearest whole second", () => {
    expect(formatDuration(59.6)).toBe("1:00");
  });

  it("falls back to 0:00 for a non-positive or non-finite input", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(-1)).toBe("0:00");
    expect(formatDuration(NaN)).toBe("0:00");
  });
});

describe("formatBitrate", () => {
  it("renders bps below 1000", () => {
    expect(formatBitrate(500)).toBe("500 bps");
  });

  it("renders Kbps below 1,000,000", () => {
    expect(formatBitrate(320_000)).toBe("320.0 Kbps");
  });

  it("renders Mbps at 1,000,000 and above", () => {
    expect(formatBitrate(5_200_000)).toBe("5.2 Mbps");
  });

  it("falls back to 0 bps for a non-positive or non-finite input", () => {
    expect(formatBitrate(0)).toBe("0 bps");
    expect(formatBitrate(-1)).toBe("0 bps");
    expect(formatBitrate(NaN)).toBe("0 bps");
  });
});

describe("formatFps", () => {
  it("renders a whole frame rate without decimals", () => {
    expect(formatFps(30)).toBe("30 fps");
    expect(formatFps(60)).toBe("60 fps");
  });

  it("renders a fractional frame rate with two decimals", () => {
    expect(formatFps(29.97)).toBe("29.97 fps");
    expect(formatFps(23.976)).toBe("23.98 fps");
  });

  it("falls back to 0 fps for a non-positive or non-finite input", () => {
    expect(formatFps(0)).toBe("0 fps");
    expect(formatFps(-1)).toBe("0 fps");
    expect(formatFps(NaN)).toBe("0 fps");
  });
});
