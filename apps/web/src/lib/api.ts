import "server-only";
import { ReadError } from "./network";

/**
 * Wraps an API route: parses JSON, runs `fn`, and answers with JSON. Errors
 * meant for people (ReadError) come back as 400 with their message; anything
 * else is logged and answered with a generic 500.
 */
export function jsonRoute<T>(fn: (body: Record<string, unknown>, req: Request) => Promise<T>) {
  return async (req: Request) => {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ error: "The request wasn't valid JSON." }, { status: 400 });
    }
    try {
      return Response.json(await fn(body, req));
    } catch (e) {
      if (e instanceof ReadError) return Response.json({ error: e.message }, { status: 400 });
      console.error(e);
      return Response.json({ error: "Something went wrong on our side. Try again in a moment." }, { status: 500 });
    }
  };
}

export const str = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !v) throw new ReadError(`Missing ${name}.`);
  return v;
};
