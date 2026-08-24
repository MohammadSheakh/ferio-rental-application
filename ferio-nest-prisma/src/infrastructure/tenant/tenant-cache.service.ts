import { Injectable } from '@nestjs/common';
import type { TenantContext } from './tenant-resolver.middleware';

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Shared cache store for tenant resolution (§4.4).
 *
 * A dedicated provider so every consumer — the resolver middleware AND
 * admin actions like suspension — mutates the SAME maps. The previous
 * per-class maps meant `clearCache()` from a controller never reached
 * the middleware's live cache.
 */
@Injectable()
export class TenantCacheService {
  private readonly contextCache = new Map<string, Entry<TenantContext>>();
  private readonly domainCache = new Map<string, Entry<string | null>>();
  private readonly TTL_MS = 60_000;

  getContext(slug: string): TenantContext | null {
    const hit = this.contextCache.get(slug);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    this.contextCache.delete(slug);
    return null;
  }

  setContext(slug: string, context: TenantContext): void {
    this.contextCache.set(slug, {
      value: context,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  /** Only positive domain resolutions are cached (never poison). */
  getDomain(hostname: string): string | null | undefined {
    const hit = this.domainCache.get(hostname);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    if (hit) this.domainCache.delete(hostname);
    return undefined; // undefined = not cached
  }

  setDomain(hostname: string, slug: string): void {
    this.domainCache.set(hostname, {
      value: slug,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  invalidateContext(slug: string): void {
    this.contextCache.delete(slug);
  }

  clear(): void {
    this.contextCache.clear();
    this.domainCache.clear();
  }
}
