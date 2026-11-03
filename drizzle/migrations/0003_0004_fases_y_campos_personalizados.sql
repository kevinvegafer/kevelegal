CREATE TABLE public.fases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id uuid NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  plantilla_id uuid REFERENCES public.plantillas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fases TO authenticated;
GRANT ALL ON public.fases TO service_role;
ALTER TABLE public.fases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fases_select" ON public.fases FOR SELECT TO authenticated USING (public.es_miembro(estudio_id));
CREATE POLICY "fases_insert" ON public.fases FOR INSERT TO authenticated WITH CHECK (public.es_miembro(estudio_id));
CREATE POLICY "fases_update" ON public.fases FOR UPDATE TO authenticated USING (public.es_miembro(estudio_id)) WITH CHECK (public.es_miembro(estudio_id));
CREATE POLICY "fases_delete" ON public.fases FOR DELETE TO authenticated USING (public.tiene_rol(estudio_id,'admin') OR public.tiene_rol(estudio_id,'abogado'));
CREATE TRIGGER auditoria_fases AFTER INSERT OR UPDATE OR DELETE ON public.fases FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

CREATE TABLE public.campos_personalizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id uuid NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  materia text,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto','numero','fecha','casilla')),
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campos_personalizados TO authenticated;
GRANT ALL ON public.campos_personalizados TO service_role;
ALTER TABLE public.campos_personalizados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_select" ON public.campos_personalizados FOR SELECT TO authenticated USING (public.es_miembro(estudio_id));
CREATE POLICY "cp_insert" ON public.campos_personalizados FOR INSERT TO authenticated WITH CHECK (public.es_miembro(estudio_id));
CREATE POLICY "cp_update" ON public.campos_personalizados FOR UPDATE TO authenticated USING (public.es_miembro(estudio_id)) WITH CHECK (public.es_miembro(estudio_id));
CREATE POLICY "cp_delete" ON public.campos_personalizados FOR DELETE TO authenticated USING (public.tiene_rol(estudio_id,'admin') OR public.tiene_rol(estudio_id,'abogado'));
CREATE TRIGGER auditoria_campos_personalizados AFTER INSERT OR UPDATE OR DELETE ON public.campos_personalizados FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

ALTER TABLE public.expedientes ADD COLUMN fase_id uuid REFERENCES public.fases(id) ON DELETE SET NULL;
ALTER TABLE public.expedientes ADD COLUMN fase_desde timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.expedientes ADD COLUMN campos_extra jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.marcar_fase_desde() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.fase_id IS DISTINCT FROM OLD.fase_id THEN NEW.fase_desde := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expedientes_fase_desde BEFORE UPDATE ON public.expedientes FOR EACH ROW EXECUTE FUNCTION public.marcar_fase_desde();