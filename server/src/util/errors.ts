/** An error whose message is safe to show to players. Anything else becomes a generic 500. */
export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GameError";
    this.status = status;
  }
}
