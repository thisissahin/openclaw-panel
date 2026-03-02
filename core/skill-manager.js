import { readdirSync, renameSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const GLOBAL_SKILLS = '/usr/lib/node_modules/openclaw/skills';
const DISABLED_SKILLS = join(GLOBAL_SKILLS, 'disabled');

export class SkillManager {
  static list() {
    try {
      if (!existsSync(DISABLED_SKILLS)) mkdirSync(DISABLED_SKILLS);

      const active = readdirSync(GLOBAL_SKILLS).filter(f => !['disabled', '.', '..'].includes(f) && !f.includes('.'));
      const disabled = readdirSync(DISABLED_SKILLS).filter(f => !['.', '..'].includes(f) && !f.includes('.'));

      return {
        active: active.map(name => ({ name, enabled: true })),
        disabled: disabled.map(name => ({ name, enabled: false }))
      };
    } catch (e) {
      console.error('SkillManager.list failed:', e);
      return { active: [], disabled: [] };
    }
  }

  static toggle(name, enable) {
    try {
      if (!existsSync(DISABLED_SKILLS)) mkdirSync(DISABLED_SKILLS);

      const activePath = join(GLOBAL_SKILLS, name);
      const disabledPath = join(DISABLED_SKILLS, name);

      let changed = false;
      if (enable) {
        if (existsSync(disabledPath)) {
          renameSync(disabledPath, activePath);
          changed = true;
        }
      } else {
        if (existsSync(activePath)) {
          renameSync(activePath, disabledPath);
          changed = true;
        }
      }

      if (changed) {
        // Restart gateway to reload tool schemas
        execSync('openclaw gateway restart', { timeout: 10000 });
        return { ok: true, message: `Skill ${name} ${enable ? 'enabled' : 'disabled'}. Gateway restarted.` };
      }

      return { ok: false, error: 'Skill not found or already in target state' };
    } catch (e) {
      console.error('SkillManager.toggle failed:', e);
      return { ok: false, error: String(e) };
    }
  }
}
