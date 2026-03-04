export class Masker {
  private maskFields: string[];

  constructor(maskFields: string[] = []) {
    this.maskFields = [
      ...maskFields,
      "password",
      "token",
      "apiKey",
      "secret",
      "creditCard",
      "ssn",
    ];
  }

  maskEvent(event: unknown): unknown {
    return this.maskObject(event);
  }

  maskHeaders(headers: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined || value === null) continue;
      const str = Array.isArray(value) ? value[0] : String(value);
      const lower = key.toLowerCase();
      if (lower === "authorization") {
        result[key] = this.maskValue(str);
      } else if (lower === "cookie") {
        result[key] = "[MASKED]";
      } else {
        result[key] = str;
      }
    }
    return result;
  }

  private maskObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => this.maskObject(item));
    }
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.shouldMaskField(key)) {
        masked[key] = this.maskValue(value);
      } else {
        masked[key] = this.maskObject(value);
      }
    }
    return masked;
  }

  private shouldMaskField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return this.maskFields.some((mask) => lowerField.includes(mask.toLowerCase()));
  }

  private maskValue(value: unknown): string {
    if (typeof value === "string" && value.length > 0) {
      if (value.length <= 4) return "[MASKED]";
      return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
    }
    return "[MASKED]";
  }
}
