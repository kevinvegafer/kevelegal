// Solo servidor: llamadas a Lovable AI Gateway (Responses).
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

const RUN_ID = "X-Lovable-AIG-Run-ID";

export function crearFetchConRunId() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_ID)) headers.set(RUN_ID, runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get(RUN_ID)?.trim() || undefined;
    return res;
  };
}

export async function responderConIA(apiKey: string, instructions: string, messages: ModelMessage[]) {
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: crearFetchConRunId(),
  });
  let fallo: unknown;
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: instructions,
    messages,
    maxRetries: 1,
    onError: ({ error }) => { fallo = error; },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const texto = await result.text;
  if (fallo) throw fallo;
  return texto;
}

export function mensajeErrorIA(error: unknown): string {
  const status = (error as { statusCode?: number })?.statusCode;
  if (status === 402) return "Se agotaron los créditos de IA del espacio de trabajo. Agregue créditos para seguir usando el asistente.";
  if (status === 403) return "El uso de IA está bloqueado para este espacio de trabajo (límite o permiso).";
  if (status === 429) return "Demasiadas consultas seguidas. Espere un momento y vuelva a intentar.";
  if (status === 400) return "Los documentos no se pudieron procesar. Pruebe con menos archivos o más pequeños.";
  return "El asistente no pudo responder ahora. Intente nuevamente.";
}
