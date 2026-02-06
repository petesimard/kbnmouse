// Auto-discover built-in apps from .jsx files in this directory.
// Each file must export: `export const meta = { key, name, icon, description }`
// and a default component. Drop in a new .jsx file and it registers itself.
// Optionally export `configSchema` for dashboard-editable settings (same system as challenges).

import { registerConfigSchema } from '../challenges/schemas.js';

const modules = import.meta.glob('./*.jsx', { eager: true });

const apps = [];
const components = {};

for (const [path, mod] of Object.entries(modules)) {
  if (!mod.meta || !mod.default) continue;
  apps.push(mod.meta);
  components[mod.meta.key] = mod.default;
  if (mod.configSchema) {
    registerConfigSchema(mod.meta.key, mod.configSchema);
  }
}

// Plugin registration for apps loaded outside this directory
export function registerPlugin(meta, component) {
  if (!meta.key || !meta.name || !meta.icon) {
    throw new Error('Plugin requires key, name, and icon');
  }
  if (components[meta.key]) {
    throw new Error(`Built-in app "${meta.key}" is already registered`);
  }
  apps.push(meta);
  components[meta.key] = component;
}

export function getBuiltinApps() {
  return apps;
}

export function getBuiltinComponent(key) {
  return components[key] || null;
}

export function getBuiltinComponents() {
  return components;
}
