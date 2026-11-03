<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Kevelegal — architecture rules

- Multi-tenant by `estudio_id`: every business table carries `estudio_id` and RLS uses `es_miembro()` / `tiene_rol()` security-definer helpers. Why: each law firm must only ever see its own data, enforced in the database.
- Roles live in `estudio_miembros.rol` (per studio), never on `profiles`. Why: avoids privilege escalation and allows one user in several studios.
- Studio creation and invitation acceptance go through the `crear_estudio` / `aceptar_invitacion` RPCs. Why: membership rows must never be inserted directly by clients.
- Data access uses the browser client with RLS plus TanStack Query options in `src/lib/queries.ts`; mutations invalidate by query-key prefix. Why: one place for reads, permissions enforced server-side by RLS.
- Signed-in app pages live under `src/routes/_authenticated/_estudio/`; its `beforeLoad` resolves the current studio and role into route context, read via `useEstudio()`. Why: every page gets studio + permissions without refetching.
- Peru-specific rules (DNI/RUC/CE validation, national holidays, business-day deadline calculation, judicial districts, catalogs) live in `src/lib/peru.ts` with tests in `src/lib/peru.test.ts`. Why: legal rules must be centralized and tested.
- Audit log is written by the `registrar_auditoria` trigger on business tables. Why: history cannot be skipped by client code.
- Documents are stored in the private `documentos` bucket under `{estudio_id}/{expediente_id}/...`; storage RLS checks membership from the first folder. Why: files follow the same tenant isolation as rows.
- Forms read values with `formValues()` from `src/components/app/ui.tsx`; add new field names to `CampoForm`. Why: the strict tsconfig forbids index-signature access.
- Do not ship fake integrations (SUNAT, CEJ/Poder Judicial, firma digital); add them only behind real providers. Why: product brief forbids simulated integrations.
- Process templates: `plantillas` + `plantilla_items` tables; applying one goes through the `aplicar_plantilla` RPC, which receives items with dates already computed client-side (`calcularItems` in `src/components/forms/PlantillaForms.tsx` uses `calcularVencimiento` for business days) and inserts plazos + eventos in one transaction. Why: Peruvian holiday logic lives in TS, and bulk creation must be atomic.
- Case stages: `fases` table per studio + `expedientes.fase_id/fase_desde` (trigger stamps fase_desde); a stage may link a plantilla applied on entry from /tablero. Custom fields: `campos_personalizados` definitions, values in `expedientes.campos_extra` jsonb keyed by field id. Why: Clio-style Kanban and per-practice fields without schema changes per firm.
- Task dependencies: `plazos.parent_id` (subtasks) and `plazos.depende_de` + `desfase_dias`; when a task is completed, `reprogramarDependientes` in `src/lib/tareas.ts` moves direct dependents by business days (client-side, tested). Why: holiday logic lives in TS.
- In-app alerts come from the `mis_avisos(_estudio)` SQL function, derived from stored dates (event reminders, due tasks, overdue installments) plus event-driven `notificaciones` rows; dismissals go to `avisos_descartados`. Why: no scheduled jobs needed.
- Client portal and public booking use token/slug-checked `security definer` RPCs callable by anon (`portal_datos`, `portal_enviar_mensaje`, `agenda_publica`, `reservar_cita`); portal file transfer goes through `src/lib/portal.functions.ts` with the admin client after token validation. Why: clients have no accounts.
- Expiring document links are `enlaces_documento` tokens served by `/api/public/enlace/$token`, which issues a 60-second signed URL. Why: links can be revoked and counted.
- Installment status is derived by applying payments FIFO to `cuotas` (`estadoCuotas` in `src/lib/cobranza.ts`); public slot generation is in `src/lib/agenda.ts` (Lima time). Both are tested.
- Document AI runs in `src/lib/asistente.functions.ts` (auth middleware, RLS download, Lovable AI Gateway Responses). Why: keys and prompts stay server-side.
- Feature-specific query options may live in `src/lib/queries-*.ts` / `*.queries.ts` next to `src/lib/queries.ts`. Why: keeps the shared file manageable.
