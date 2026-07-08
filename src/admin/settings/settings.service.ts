import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SETTINGS_REGISTRY,
  SETTINGS_BY_KEY,
  CATEGORY_META,
  SettingDef,
  SettingCategory,
} from './settings.registry';

/** Where an effective value came from. */
type Source = 'override' | 'env' | 'default';

/** A setting as returned to the admin UI (secrets are masked). */
export interface SettingView {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  type: SettingDef['type'];
  secret: boolean;
  readOnly: boolean;
  min?: number;
  max?: number;
  source: Source;
  isOverridden: boolean; // has a DB override on top of env/default
  // Non-secret: coerced value. Secret: omitted (use isSet/masked instead).
  value?: string | number | boolean;
  isSet?: boolean; // secret only — is any non-empty value configured
  masked?: string; // secret only — masked preview
}

export interface SettingsGroup {
  category: SettingCategory;
  label: string;
  description: string;
  settings: SettingView[];
}

function mask(value: string): string {
  if (!value) return '';
  const tail = value.slice(-4);
  return value.length <= 4 ? '••••' : `••••••••${tail}`;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /** All DB overrides as a key→value map. */
  private async overrides(): Promise<Map<string, string>> {
    const rows = await this.prisma.systemSetting.findMany();
    return new Map(rows.map((r) => [r.key, r.value]));
  }

  /** Effective raw string value + its source, for one definition. */
  private resolve(def: SettingDef, overrides: Map<string, string>): { raw: string; source: Source } {
    if (overrides.has(def.key)) return { raw: overrides.get(def.key)!, source: 'override' };
    const envVal = def.env ? process.env[def.env] : undefined;
    if (envVal != null && envVal !== '') return { raw: envVal, source: 'env' };
    return { raw: def.default, source: 'default' };
  }

  /** Coerce a raw string to the setting's declared JS type. */
  private coerce(def: SettingDef, raw: string): string | number | boolean {
    switch (def.type) {
      case 'int':
        return raw === '' ? 0 : parseInt(raw, 10);
      case 'float':
        return raw === '' ? 0 : parseFloat(raw);
      case 'boolean':
        return raw === 'true' || raw === '1';
      default:
        return raw;
    }
  }

  private toView(def: SettingDef, overrides: Map<string, string>): SettingView {
    const { raw, source } = this.resolve(def, overrides);
    const base: SettingView = {
      key: def.key,
      label: def.label,
      description: def.description,
      category: def.category,
      type: def.type,
      secret: !!def.secret,
      readOnly: !!def.readOnly,
      min: def.min,
      max: def.max,
      source,
      isOverridden: source === 'override',
    };
    if (def.secret) {
      return { ...base, isSet: raw !== '', masked: mask(raw) };
    }
    return { ...base, value: this.coerce(def, raw) };
  }

  /** Full settings list, grouped by category, for the admin screen. */
  async list(): Promise<SettingsGroup[]> {
    const overrides = await this.overrides();
    // 'integrations' (API Keys & Integrations) and 'system' are intentionally hidden
    // from the admin Settings screen; their keys still resolve via env/defaults.
    const order: SettingCategory[] = ['leadgen', 'scheduling'];
    return order.map((category) => ({
      category,
      label: CATEGORY_META[category].label,
      description: CATEGORY_META[category].description,
      settings: SETTINGS_REGISTRY.filter((d) => d.category === category).map((d) =>
        this.toView(d, overrides),
      ),
    }));
  }

  /** Validate + normalize an incoming value to its stored string form. */
  private normalize(def: SettingDef, value: unknown): string {
    switch (def.type) {
      case 'int': {
        const n = typeof value === 'number' ? value : parseInt(String(value), 10);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
          throw new BadRequestException(`${def.label} must be a whole number`);
        }
        if (def.min != null && n < def.min) throw new BadRequestException(`${def.label} must be ≥ ${def.min}`);
        if (def.max != null && n > def.max) throw new BadRequestException(`${def.label} must be ≤ ${def.max}`);
        return String(n);
      }
      case 'float': {
        const n = typeof value === 'number' ? value : parseFloat(String(value));
        if (!Number.isFinite(n)) throw new BadRequestException(`${def.label} must be a number`);
        if (def.min != null && n < def.min) throw new BadRequestException(`${def.label} must be ≥ ${def.min}`);
        if (def.max != null && n > def.max) throw new BadRequestException(`${def.label} must be ≤ ${def.max}`);
        return String(n);
      }
      case 'boolean': {
        const b = value === true || value === 'true' || value === '1';
        return b ? 'true' : 'false';
      }
      default:
        return value == null ? '' : String(value);
    }
  }

  /** Upsert a single override. Rejects unknown/read-only keys. */
  async update(key: string, value: unknown, updatedBy?: string): Promise<SettingView> {
    const def = SETTINGS_BY_KEY[key];
    if (!def) throw new NotFoundException(`Unknown setting: ${key}`);
    if (def.readOnly) throw new BadRequestException(`${def.label} is read-only`);

    const normalized = this.normalize(def, value);
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: normalized, category: def.category, updatedBy },
      update: { value: normalized, updatedBy },
    });

    const overrides = await this.overrides();
    return this.toView(def, overrides);
  }

  /** Remove an override, reverting to the env/default value. */
  async reset(key: string): Promise<SettingView> {
    const def = SETTINGS_BY_KEY[key];
    if (!def) throw new NotFoundException(`Unknown setting: ${key}`);
    await this.prisma.systemSetting.deleteMany({ where: { key } });
    const overrides = await this.overrides();
    return this.toView(def, overrides);
  }

  // ── Consumption helpers (for other services to read effective values) ────────

  /** Effective raw string value for a key (override ?? env ?? default). */
  async get(key: string): Promise<string> {
    const def = SETTINGS_BY_KEY[key];
    if (!def) throw new NotFoundException(`Unknown setting: ${key}`);
    return this.resolve(def, await this.overrides()).raw;
  }

  async getNumber(key: string): Promise<number> {
    return Number(await this.get(key));
  }

  async getBool(key: string): Promise<boolean> {
    const raw = await this.get(key);
    return raw === 'true' || raw === '1';
  }
}
