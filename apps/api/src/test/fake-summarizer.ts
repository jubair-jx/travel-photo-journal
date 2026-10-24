import type { Summarizer } from "../lib/summarizer.js";
import { SummaryError } from "../lib/summarizer.js";

// Answers "Summary of: <first words>" so tests can tell which description produced a summary.
export class FakeSummarizer implements Summarizer {
  readonly inputs: string[] = [];
  private failing = false;

  summarize(text: string): Promise<string> {
    this.inputs.push(text);
    if (this.failing) return Promise.reject(new SummaryError("summary unavailable (fake)"));
    return Promise.resolve(`Summary of: ${text.split(" ").slice(0, 3).join(" ")}`);
  }

  failAll(): void {
    this.failing = true;
  }

  clear(): void {
    this.inputs.length = 0;
    this.failing = false;
  }
}
