import { accessError } from "@/lib/access";
import { createResourceLimits } from "@/lib/resource-limits";
import { RequestBodyError } from "@/lib/request-body";
const limits = createResourceLimits();
const budgets = {
  pdf: { perMinute: 12, concurrent: 2 },
  youtube: { perMinute: 20, concurrent: 4 },
  chat: { perMinute: 30, concurrent: 4 },
  token: { perMinute: 6, concurrent: 2 },
};
export function protectedRoute(name: keyof typeof budgets, handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const denied = accessError(request);
    if (denied) return denied;
    const budget = budgets[name];
    const lease = limits.enter(name, budget.perMinute, budget.concurrent);
    if (!lease.release) return Response.json({ error: lease.status === 429
      ? "Demo request limit reached. Please wait before retrying."
      : "The demo is busy. Please retry in a few seconds." }, {
      status: lease.status, headers: { "Retry-After": String(lease.retryAfter), "Cache-Control": "no-store" },
    });
    try { return await handler(request); }
    catch (error) {
      if (error instanceof RequestBodyError) return Response.json({error: error.message}, {status: error.status});
      console.error("Route failed", {route: name, type: error instanceof Error ? error.name : "UnknownError"});
      return Response.json({error: "Request failed. Please retry."}, {status: 500});
    } finally { lease.release(); }
  };
}
