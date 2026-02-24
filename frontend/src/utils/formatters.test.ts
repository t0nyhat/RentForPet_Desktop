import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  formatDate,
  formatDateShort,
  formatDateMedium,
  formatDateTime,
  formatTime,
  formatCurrency,
  formatNumber,
  getWeekdayName,
  getMonthName,
  getCurrencyCode,
  getLocale,
} from "./formatters";

describe("Formatter Utils", () => {
  const testDate = new Date("2024-03-15T14:30:00");
  const testDateString = "2024-03-15T14:30:00";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLocale", () => {
    it("returns locale string", () => {
      const locale = getLocale();
      expect(locale).toMatch(/^(en-US|ru-RU)$/);
    });
  });

  describe("formatDate", () => {
    it("formats Date object correctly", () => {
      const result = formatDate(testDate);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("formats string date correctly", () => {
      const result = formatDate(testDateString);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("accepts custom format options", () => {
      const result = formatDate(testDate, { year: "numeric", month: "long" });
      expect(result).toBeTruthy();
    });
  });

  describe("formatDateShort", () => {
    it("returns short date format", () => {
      const result = formatDateShort(testDate);
      expect(result).toBeTruthy();
      expect(result.length).toBeLessThan(20);
    });
  });

  describe("formatDateMedium", () => {
    it("returns medium date format", () => {
      const result = formatDateMedium(testDate);
      expect(result).toBeTruthy();
      expect(result).toContain("2024");
    });
  });

  describe("formatDateTime", () => {
    it("includes both date and time", () => {
      const result = formatDateTime(testDate);
      expect(result).toBeTruthy();
      expect(result).toContain(":");
    });

    it("works with string input", () => {
      const result = formatDateTime(testDateString);
      expect(result).toBeTruthy();
    });
  });

  describe("formatTime", () => {
    it("returns only time portion", () => {
      const result = formatTime(testDate);
      expect(result).toBeTruthy();
      expect(result).toContain(":");
    });
  });

  describe("getCurrencyCode", () => {
    it("returns valid currency code", () => {
      const code = getCurrencyCode();
      expect(["USD", "RUB"]).toContain(code);
    });
  });

  describe("formatCurrency", () => {
    it("formats positive amounts", () => {
      const result = formatCurrency(1000);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("formats zero", () => {
      const result = formatCurrency(0);
      expect(result).toBeTruthy();
    });

    it("formats negative amounts", () => {
      const result = formatCurrency(-500);
      expect(result).toBeTruthy();
    });

    it("formats large amounts", () => {
      const result = formatCurrency(1000000);
      expect(result).toBeTruthy();
    });
  });

  describe("formatNumber", () => {
    it("formats integers by default", () => {
      const result = formatNumber(1234);
      expect(result).toBeTruthy();
    });

    it("formats with specified decimals", () => {
      const result = formatNumber(1234.5678, 2);
      expect(result).toBeTruthy();
    });

    it("handles zero decimals explicitly", () => {
      const result = formatNumber(1234.9999, 0);
      expect(result).toBeTruthy();
    });
  });

  describe("getWeekdayName", () => {
    it("returns weekday in short format", () => {
      const result = getWeekdayName(testDate, "short");
      expect(result).toBeTruthy();
      expect(result.length).toBeLessThan(10);
    });

    it("returns weekday in long format", () => {
      const result = getWeekdayName(testDate, "long");
      expect(result).toBeTruthy();
    });

    it("works with string dates", () => {
      const result = getWeekdayName(testDateString);
      expect(result).toBeTruthy();
    });
  });

  describe("getMonthName", () => {
    it("returns month in long format by default", () => {
      const result = getMonthName(testDate);
      expect(result).toBeTruthy();
    });

    it("returns month in short format", () => {
      const result = getMonthName(testDate, "short");
      expect(result).toBeTruthy();
      expect(result.length).toBeLessThan(10);
    });
  });
});
