// apps/api-gateway-nest/src/common/circuit-breaker/circuit-breaker.service.ts
import { Injectable, Logger } from '@nestjs/common';

/**
 * CircuitBreakerService
 * Implements the Resilience4j-style circuit-breaker pattern for NestJS.
 *
 * States:
 *   CLOSED   — normal operation; all requests pass through
 *   OPEN     — circuit tripped; fast-fail with fallback for cooldown period
 *   HALF_OPEN — one probe request allowed; resets to CLOSED on success
 *
 * If the ML Agent (FastAPI) is slow or down, the Gateway returns a cached
 * "Safe Mode" answer rather than cascading a timeout to the end user.
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  successCount: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  /**
   * Threshold: consecutive failures before the circuit trips.
   * Override with CIRCUIT_FAILURE_THRESHOLD env var.
   */
  private readonly FAILURE_THRESHOLD = parseInt(
    process.env.CIRCUIT_FAILURE_THRESHOLD ?? '5', 10,
  );

  /**
   * Cooldown period (ms) before moving from OPEN → HALF_OPEN.
   * Override with CIRCUIT_COOLDOWN_MS env var.
   */
  private readonly COOLDOWN_MS = parseInt(
    process.env.CIRCUIT_COOLDOWN_MS ?? '30000', 10,
  );

  /**
   * Consecutive successes in HALF_OPEN needed to close the circuit.
   * Override with CIRCUIT_RECOVERY_SUCCESSES env var.
   */
  private readonly RECOVERY_SUCCESSES = parseInt(
    process.env.CIRCUIT_RECOVERY_SUCCESSES ?? '2', 10,
  );

  private readonly breakers = new Map<string, CircuitBreaker>();

  private getBreaker(name: string): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, {
        state: 'CLOSED',
        failures: 0,
        lastFailureAt: 0,
        successCount: 0,
      });
    }
    return this.breakers.get(name)!;
  }

  /**
   * Execute a function protected by a named circuit breaker.
   *
   * @param name     Unique identifier for this circuit (e.g. 'brain-reason')
   * @param fn       The async operation to protect
   * @param fallback Called when the circuit is OPEN; must never throw
   */
  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    fallback: () => T,
  ): Promise<T> {
    const breaker = this.getBreaker(name);

    // Transition OPEN → HALF_OPEN after cooldown
    if (
      breaker.state === 'OPEN' &&
      Date.now() - breaker.lastFailureAt > this.COOLDOWN_MS
    ) {
      breaker.state = 'HALF_OPEN';
      breaker.successCount = 0;
      this.logger.log(`Circuit '${name}' → HALF_OPEN`);
    }

    // Fast-fail when open
    if (breaker.state === 'OPEN') {
      this.logger.warn(`Circuit '${name}' is OPEN — returning safe-mode fallback`);
      return fallback();
    }

    try {
      const result = await fn();

      // Record success
      if (breaker.state === 'HALF_OPEN') {
        breaker.successCount++;
        if (breaker.successCount >= this.RECOVERY_SUCCESSES) {
          breaker.state = 'CLOSED';
          breaker.failures = 0;
          this.logger.log(`Circuit '${name}' → CLOSED (recovered)`);
        }
      } else {
        breaker.failures = 0;
      }

      return result;
    } catch (err) {
      breaker.failures++;
      breaker.lastFailureAt = Date.now();

      if (breaker.failures >= this.FAILURE_THRESHOLD || breaker.state === 'HALF_OPEN') {
        breaker.state = 'OPEN';
        this.logger.error(
          `Circuit '${name}' → OPEN after ${breaker.failures} failure(s): ${err}`,
        );
      }

      return fallback();
    }
  }

  /** Expose circuit states for health checks / admin dashboard. */
  getStates(): Record<string, CircuitState> {
    const result: Record<string, CircuitState> = {};
    this.breakers.forEach((b, name) => {
      result[name] = b.state;
    });
    return result;
  }
}
