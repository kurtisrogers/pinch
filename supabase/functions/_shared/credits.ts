export const TOOL_COSTS = {
  scan: 1,
  devaudit: 2,
  crawl: 4,
} as const;

export type BillableTool = keyof typeof TOOL_COSTS;

export function toolCost(tool: string): number {
  const cost = TOOL_COSTS[tool as BillableTool];
  if (cost === undefined) {
    throw new Error(`Unknown tool: ${tool}`);
  }
  return cost;
}

export function isBillableTool(tool: string): tool is BillableTool {
  return tool in TOOL_COSTS;
}
