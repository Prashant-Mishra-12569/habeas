/** JSON.stringify that survives what Soroban returns: bigint (u64, i128) and raw bytes. */
export function toJson(value: unknown, space = 2): string {
  return JSON.stringify(
    value,
    (_key, v: unknown) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Uint8Array) return Buffer.from(v).toString("hex");
      if (v instanceof Error) return { name: v.name, message: v.message };
      return v;
    },
    space,
  );
}
