import { handleEvaluations } from "@/lib/handlers";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleEvaluations(request);
}
