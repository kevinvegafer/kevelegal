// Elige entre el cliente real y el cliente local del modo prueba.
import { supabase as real } from "../integrations/supabase/client";
import { demoActivo, demoClient } from "./demo-client";

export const supabase = new Proxy({} as typeof real, {
  get(_, prop) {
    if (demoActivo()) return (demoClient as Record<string | symbol, unknown>)[prop];
    return Reflect.get(real, prop);
  },
});
