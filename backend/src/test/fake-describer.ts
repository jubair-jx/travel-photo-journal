import { DescribeError, type DescribeInput, type Describer } from "../lib/describer.js";

// Answers "Described: <title>" so tests can tell what context reached the model.
export class FakeDescriber implements Describer {
  readonly inputs: DescribeInput[] = [];
  private mode: "ok" | "off" | "failing" = "ok";

  describe(input: DescribeInput): Promise<string | null> {
    this.inputs.push(input);
    if (this.mode === "off") return Promise.resolve(null);
    if (this.mode === "failing")
      return Promise.reject(new DescribeError("description unavailable (fake)"));
    return Promise.resolve(`Described: ${input.name ?? "untitled"}`);
  }

  switchOff(): void {
    this.mode = "off";
  }

  failAll(): void {
    this.mode = "failing";
  }

  clear(): void {
    this.inputs.length = 0;
    this.mode = "ok";
  }
}
