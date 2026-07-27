import type { ComponentType } from "react";
import type { AnyFieldConfig } from "./types";

export type FieldComponentProps = { field: AnyFieldConfig };

type FieldRegistryMap = Map<string, ComponentType<FieldComponentProps>>;

const REGISTRY_KEY = Symbol.for("form-builder.fieldRegistry.v1");

function getRegistry(): FieldRegistryMap {
  const globalWithRegistry = globalThis as unknown as Record<symbol, FieldRegistryMap | undefined>;
  const existing = globalWithRegistry[REGISTRY_KEY];
  if (existing) return existing;
  const created: FieldRegistryMap = new Map();
  globalWithRegistry[REGISTRY_KEY] = created;
  return created;
}

export function registerField(type: string, component: ComponentType<FieldComponentProps>): void {
  getRegistry().set(type, component);
}

export function getField(type: string): ComponentType<FieldComponentProps> | undefined {
  return getRegistry().get(type);
}

export function getRegisteredTypes(): string[] {
  return [...getRegistry().keys()];
}
