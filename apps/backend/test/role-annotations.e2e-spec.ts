import { join } from 'path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { HouseholdMembershipGuard } from '../src/household/guards/household-membership.guard';
import { HOUSEHOLD_ROLES_KEY } from '../src/household/guards/require-role.decorator';
import { HouseholdRole } from '../src/household/household-role.enum';

const fixture = (name: string) => join(__dirname, '__fixtures__', name);

/** HTTP methods that change state and therefore need a role requirement. */
const WRITE_METHODS: ReadonlySet<RequestMethod> = new Set([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);

/** The route segment that marks an endpoint as household-scoped. */
const HOUSEHOLD_SCOPE_SEGMENT = '/households/:householdId';

interface RouteHandlerInfo {
  /** e.g. `FeedingController.update` */
  readonly label: string;
  /** e.g. `POST /households/:householdId/children/:childId/feeding-events` */
  readonly route: string;
  readonly roles: unknown;
  readonly guards: unknown[];
}

/**
 * ROL-3 — the standing audit that no household-scoped writing endpoint ships
 * without an explicit `@RequireRole(...)`.
 *
 * This is the *static* half of the ROL-2 defence; `HouseholdMembershipGuard`'s
 * runtime default-deny is the other half. The runtime check alone would only
 * surface as a mysterious 403 the first time someone exercised the new route,
 * so this walks the whole DI container instead and names the offender.
 *
 * Lives in `test/` rather than `src/` because it needs the fully-assembled
 * `AppModule` (every controller from every feature module) — but unlike the
 * other e2e suites it never listens on a port or touches the database: the
 * compiled container is enough to read route metadata off.
 */
describe('Household route role annotations (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  let moduleFixture: TestingModule;
  let routes: RouteHandlerInfo[];

  beforeAll(async () => {
    process.env.CONFIG_PATH = fixture('e2e.config.yml');
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    process.env.JWT_ACCESS_SECRET = 'e2e-test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-test-refresh-secret';

    moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    routes = collectHouseholdScopedRoutes(moduleFixture);
  });

  afterAll(async () => {
    await moduleFixture.close();
    process.env.CONFIG_PATH = originalEnv.CONFIG_PATH;
    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = originalEnv.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = originalEnv.JWT_REFRESH_SECRET;
  });

  it('finds the household-scoped routes at all', () => {
    // Guards the audit itself: a refactor that broke the container walk would
    // otherwise turn every assertion below into a vacuous pass over an empty
    // list. The exact number is irrelevant; "clearly more than a handful" is
    // the signal.
    expect(routes.length).toBeGreaterThan(20);
  });

  it('annotates every writing endpoint with an explicit role requirement (ROL-2/ROL-3)', () => {
    const offenders = routes
      .filter((route) => isWrite(route) && !hasRoleRequirement(route))
      .map((route) => `${route.label} — ${route.route}`);

    expect(offenders).toEqual([]);
  });

  it('declares only known roles', () => {
    const knownRoles = new Set<string>(Object.values(HouseholdRole));
    const offenders = routes
      .filter((route) => Array.isArray(route.roles))
      .filter((route) => (route.roles as unknown[]).some((role) => !knownRoles.has(String(role))))
      .map((route) => `${route.label} — ${JSON.stringify(route.roles)}`);

    expect(offenders).toEqual([]);
  });

  it('runs HouseholdMembershipGuard wherever a role is required', () => {
    // `@RequireRole` is inert metadata on its own — without the guard reading
    // it, an annotated route would silently allow everyone.
    const offenders = routes
      .filter(hasRoleRequirement)
      .filter((route) => !route.guards.includes(HouseholdMembershipGuard))
      .map((route) => `${route.label} — ${route.route}`);

    expect(offenders).toEqual([]);
  });
});

function isWrite(route: RouteHandlerInfo): boolean {
  return WRITE_METHODS.has(methodOf(route));
}

function methodOf(route: RouteHandlerInfo): RequestMethod {
  return RequestMethod[route.route.split(' ')[0] as keyof typeof RequestMethod];
}

function hasRoleRequirement(route: RouteHandlerInfo): boolean {
  return Array.isArray(route.roles) && route.roles.length > 0;
}

/**
 * Walks every controller in the compiled DI container and returns the route
 * handlers whose full path is nested under `/households/:householdId` — i.e.
 * exactly the set `HouseholdMembershipGuard` is responsible for.
 */
function collectHouseholdScopedRoutes(moduleFixture: TestingModule): RouteHandlerInfo[] {
  const container = moduleFixture.get(ModulesContainer);
  const reflector = moduleFixture.get(Reflector);
  const scanner = new MetadataScanner();
  const collected: RouteHandlerInfo[] = [];

  for (const module of container.values()) {
    for (const wrapper of module.controllers.values()) {
      const { instance, metatype } = wrapper;
      if (!instance || typeof metatype !== 'function') {
        continue;
      }

      const controllerPath = String(Reflect.getMetadata(PATH_METADATA, metatype) ?? '');
      const prototype = Object.getPrototypeOf(instance) as object;

      for (const methodName of scanner.getAllMethodNames(prototype)) {
        const handler = (prototype as Record<string, unknown>)[methodName];
        if (typeof handler !== 'function') {
          continue;
        }

        const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
          RequestMethod | undefined;
        if (httpMethod === undefined) {
          // Not a route handler, just a helper method on the controller.
          continue;
        }

        const handlerPath = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
        const fullPath = `/${controllerPath}/${handlerPath}`.replace(/\/{2,}/g, '/');
        if (!fullPath.startsWith(HOUSEHOLD_SCOPE_SEGMENT)) {
          continue;
        }

        collected.push({
          label: `${metatype.name}.${methodName}`,
          route: `${RequestMethod[httpMethod]} ${fullPath}`,
          // `getAllAndOverride` mirrors exactly how the guard resolves the
          // metadata, so a class-level `@RequireRole` counts here too.
          roles: reflector.getAllAndOverride(HOUSEHOLD_ROLES_KEY, [handler, metatype]),
          guards: (Reflect.getMetadata('__guards__', handler) ??
            Reflect.getMetadata('__guards__', metatype) ??
            []) as unknown[],
        });
      }
    }
  }

  return collected;
}
