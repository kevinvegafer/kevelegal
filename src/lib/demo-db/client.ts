// Modo demo: no hay base de datos. Todo se guarda en este navegador.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { demoClient } from "@/lib/demo-client";

export const supabase = demoClient as unknown as SupabaseClient<Database>;
