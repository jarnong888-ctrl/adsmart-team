export class InsufficientCreditsError extends Error {
  constructor(
    public required: number,
    public balance: number,
    public action: string,
  ) {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

export function nextBalance(balance: number, delta: number) {
  if (!Number.isInteger(balance) || !Number.isInteger(delta)) {
    throw new Error("Credits must be whole numbers.");
  }
  const next = balance + delta;
  if (next < 0) throw new InsufficientCreditsError(Math.abs(delta), balance, "balance");
  return next;
}
