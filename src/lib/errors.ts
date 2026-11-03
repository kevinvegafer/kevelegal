export function mensajeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "Ocurrió un error";
  if (/duplicate key/i.test(msg) && /clientes/i.test(msg)) return "Ya existe un cliente con ese documento";
  if (/duplicate key/i.test(msg) && /invitaciones/i.test(msg)) return "Ese correo ya fue invitado";
  if (/duplicate key/i.test(msg)) return "Ese registro ya existe";
  if (/row-level security/i.test(msg)) return "No tiene permisos para esta acción";
  if (/violates foreign key/i.test(msg)) return "El registro está vinculado a otros datos";
  return msg;
}
