export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      actuaciones: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string
          estudio_id: string
          expediente_id: string
          fecha: string
          id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion: string
          estudio_id: string
          expediente_id: string
          fecha?: string
          id?: string
          tipo?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string
          estudio_id?: string
          expediente_id?: string
          fecha?: string
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "actuaciones_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actuaciones_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: string
          created_at: string
          estudio_id: string
          id: number
          registro_id: string | null
          resumen: string | null
          tabla: string
          user_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          estudio_id: string
          id?: never
          registro_id?: string | null
          resumen?: string | null
          tabla: string
          user_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          estudio_id?: string
          id?: never
          registro_id?: string | null
          resumen?: string | null
          tabla?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_descartados: {
        Row: {
          clave: string
          created_at: string
          user_id: string
        }
        Insert: {
          clave: string
          created_at?: string
          user_id?: string
        }
        Update: {
          clave?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campos_personalizados: {
        Row: {
          created_at: string
          estudio_id: string
          id: string
          materia: string | null
          nombre: string
          orden: number
          tipo: string
        }
        Insert: {
          created_at?: string
          estudio_id: string
          id?: string
          materia?: string | null
          nombre: string
          orden?: number
          tipo?: string
        }
        Update: {
          created_at?: string
          estudio_id?: string
          id?: string
          materia?: string | null
          nombre?: string
          orden?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "campos_personalizados_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      citas: {
        Row: {
          created_at: string
          email: string | null
          estado: string
          estudio_id: string
          evento_id: string | null
          fin: string
          id: string
          inicio: string
          motivo: string | null
          nombre: string
          telefono: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          estado?: string
          estudio_id: string
          evento_id?: string | null
          fin: string
          id?: string
          inicio: string
          motivo?: string | null
          nombre: string
          telefono?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          estado?: string
          estudio_id?: string
          evento_id?: string | null
          fin?: string
          id?: string
          inicio?: string
          motivo?: string | null
          nombre?: string
          telefono?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "citas_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          apellidos: string | null
          created_at: string
          created_by: string | null
          departamento: string | null
          direccion: string | null
          distrito: string | null
          email: string | null
          estado: string
          estudio_id: string
          id: string
          nombres: string | null
          notas: string | null
          numero_documento: string
          origen: string | null
          provincia: string | null
          razon_social: string | null
          representante_legal: string | null
          responsable_id: string | null
          telefono: string | null
          tipo_documento: Database["public"]["Enums"]["tipo_documento"]
          tipo_persona: string
          updated_at: string
        }
        Insert: {
          apellidos?: string | null
          created_at?: string
          created_by?: string | null
          departamento?: string | null
          direccion?: string | null
          distrito?: string | null
          email?: string | null
          estado?: string
          estudio_id: string
          id?: string
          nombres?: string | null
          notas?: string | null
          numero_documento: string
          origen?: string | null
          provincia?: string | null
          razon_social?: string | null
          representante_legal?: string | null
          responsable_id?: string | null
          telefono?: string | null
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"]
          tipo_persona?: string
          updated_at?: string
        }
        Update: {
          apellidos?: string | null
          created_at?: string
          created_by?: string | null
          departamento?: string | null
          direccion?: string | null
          distrito?: string | null
          email?: string | null
          estado?: string
          estudio_id?: string
          id?: string
          nombres?: string | null
          notas?: string | null
          numero_documento?: string
          origen?: string | null
          provincia?: string | null
          razon_social?: string | null
          representante_legal?: string | null
          responsable_id?: string | null
          telefono?: string | null
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"]
          tipo_persona?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      cuotas: {
        Row: {
          created_at: string
          estudio_id: string
          fecha_vencimiento: string
          honorario_id: string
          id: string
          monto: number
          numero: number
        }
        Insert: {
          created_at?: string
          estudio_id: string
          fecha_vencimiento: string
          honorario_id: string
          id?: string
          monto: number
          numero?: number
        }
        Update: {
          created_at?: string
          estudio_id?: string
          fecha_vencimiento?: string
          honorario_id?: string
          id?: string
          monto?: number
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "cuotas_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuotas_honorario_id_fkey"
            columns: ["honorario_id"]
            isOneToOne: false
            referencedRelation: "honorarios"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilidad: {
        Row: {
          created_at: string
          dia_semana: number
          estudio_id: string
          hora_fin: string
          hora_inicio: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          estudio_id: string
          hora_fin: string
          hora_inicio: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          estudio_id?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidad_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          categoria: string
          cliente_id: string | null
          created_at: string
          documento_origen: string | null
          estudio_id: string
          expediente_id: string | null
          id: string
          mime_type: string | null
          nombre: string
          storage_path: string
          subido_por: string | null
          subido_por_cliente: boolean
          tamano: number | null
          version: number
          visible_cliente: boolean
        }
        Insert: {
          categoria?: string
          cliente_id?: string | null
          created_at?: string
          documento_origen?: string | null
          estudio_id: string
          expediente_id?: string | null
          id?: string
          mime_type?: string | null
          nombre: string
          storage_path: string
          subido_por?: string | null
          subido_por_cliente?: boolean
          tamano?: number | null
          version?: number
          visible_cliente?: boolean
        }
        Update: {
          categoria?: string
          cliente_id?: string | null
          created_at?: string
          documento_origen?: string | null
          estudio_id?: string
          expediente_id?: string | null
          id?: string
          mime_type?: string | null
          nombre?: string
          storage_path?: string
          subido_por?: string | null
          subido_por_cliente?: boolean
          tamano?: number | null
          version?: number
          visible_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_documento_origen_fkey"
            columns: ["documento_origen"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      enlaces_documento: {
        Row: {
          created_at: string
          created_by: string | null
          documento_id: string
          estudio_id: string
          expira_at: string
          id: string
          revocado: boolean
          token: string
          vistas: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          documento_id: string
          estudio_id: string
          expira_at: string
          id?: string
          revocado?: boolean
          token?: string
          vistas?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          documento_id?: string
          estudio_id?: string
          expira_at?: string
          id?: string
          revocado?: boolean
          token?: string
          vistas?: number
        }
        Relationships: [
          {
            foreignKeyName: "enlaces_documento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enlaces_documento_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      estudio_miembros: {
        Row: {
          created_at: string
          estudio_id: string
          id: string
          rol: Database["public"]["Enums"]["rol_estudio"]
          user_id: string
        }
        Insert: {
          created_at?: string
          estudio_id: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_estudio"]
          user_id: string
        }
        Update: {
          created_at?: string
          estudio_id?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_estudio"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estudio_miembros_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      estudios: {
        Row: {
          agenda_activa: boolean
          agenda_anticipacion_horas: number
          agenda_duracion_min: number
          agenda_slug: string | null
          created_at: string
          created_by: string
          departamento: string | null
          direccion: string | null
          distrito: string | null
          email: string | null
          id: string
          nombre: string
          provincia: string | null
          recordatorios_evento: Json
          ruc: string | null
          tarifa_hora: number
          telefono: string | null
          updated_at: string
        }
        Insert: {
          agenda_activa?: boolean
          agenda_anticipacion_horas?: number
          agenda_duracion_min?: number
          agenda_slug?: string | null
          created_at?: string
          created_by: string
          departamento?: string | null
          direccion?: string | null
          distrito?: string | null
          email?: string | null
          id?: string
          nombre: string
          provincia?: string | null
          recordatorios_evento?: Json
          ruc?: string | null
          tarifa_hora?: number
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          agenda_activa?: boolean
          agenda_anticipacion_horas?: number
          agenda_duracion_min?: number
          agenda_slug?: string | null
          created_at?: string
          created_by?: string
          departamento?: string | null
          direccion?: string | null
          distrito?: string | null
          email?: string | null
          id?: string
          nombre?: string
          provincia?: string | null
          recordatorios_evento?: Json
          ruc?: string | null
          tarifa_hora?: number
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          created_at: string
          created_by: string | null
          enlace: string | null
          estudio_id: string
          expediente_id: string | null
          fin: string | null
          id: string
          inicio: string
          lugar: string | null
          modalidad: string
          notas: string | null
          recordatorios: number[] | null
          responsable_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enlace?: string | null
          estudio_id: string
          expediente_id?: string | null
          fin?: string | null
          id?: string
          inicio: string
          lugar?: string | null
          modalidad?: string
          notas?: string | null
          recordatorios?: number[] | null
          responsable_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enlace?: string | null
          estudio_id?: string
          expediente_id?: string | null
          fin?: string | null
          id?: string
          inicio?: string
          lugar?: string | null
          modalidad?: string
          notas?: string | null
          recordatorios?: number[] | null
          responsable_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      expedientes: {
        Row: {
          campos_extra: Json
          cliente_id: string | null
          created_at: string
          created_by: string | null
          cuantia: number | null
          descripcion: string | null
          distrito_judicial: string | null
          especialista: string | null
          estado: string
          estudio_id: string
          etapa: string | null
          fase_desde: string
          fase_id: string | null
          fecha_inicio: string | null
          id: string
          juez: string | null
          materia: string
          numero_expediente: string | null
          organo_jurisdiccional: string | null
          responsable_id: string | null
          tipo_proceso: string | null
          titulo: string
          updated_at: string
          via: string
        }
        Insert: {
          campos_extra?: Json
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          cuantia?: number | null
          descripcion?: string | null
          distrito_judicial?: string | null
          especialista?: string | null
          estado?: string
          estudio_id: string
          etapa?: string | null
          fase_desde?: string
          fase_id?: string | null
          fecha_inicio?: string | null
          id?: string
          juez?: string | null
          materia?: string
          numero_expediente?: string | null
          organo_jurisdiccional?: string | null
          responsable_id?: string | null
          tipo_proceso?: string | null
          titulo: string
          updated_at?: string
          via?: string
        }
        Update: {
          campos_extra?: Json
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          cuantia?: number | null
          descripcion?: string | null
          distrito_judicial?: string | null
          especialista?: string | null
          estado?: string
          estudio_id?: string
          etapa?: string | null
          fase_desde?: string
          fase_id?: string | null
          fecha_inicio?: string | null
          id?: string
          juez?: string | null
          materia?: string
          numero_expediente?: string | null
          organo_jurisdiccional?: string | null
          responsable_id?: string | null
          tipo_proceso?: string | null
          titulo?: string
          updated_at?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedientes_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedientes_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "fases"
            referencedColumns: ["id"]
          },
        ]
      }
      fases: {
        Row: {
          created_at: string
          estudio_id: string
          id: string
          nombre: string
          orden: number
          plantilla_id: string | null
        }
        Insert: {
          created_at?: string
          estudio_id: string
          id?: string
          nombre: string
          orden?: number
          plantilla_id?: string | null
        }
        Update: {
          created_at?: string
          estudio_id?: string
          id?: string
          nombre?: string
          orden?: number
          plantilla_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fases_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fases_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          categoria: string
          concepto: string
          created_at: string
          created_by: string | null
          estudio_id: string
          expediente_id: string | null
          fecha: string
          id: string
          monto: number
          notas: string | null
          reembolsable: boolean
        }
        Insert: {
          categoria?: string
          concepto: string
          created_at?: string
          created_by?: string | null
          estudio_id: string
          expediente_id?: string | null
          fecha?: string
          id?: string
          monto: number
          notas?: string | null
          reembolsable?: boolean
        }
        Update: {
          categoria?: string
          concepto?: string
          created_at?: string
          created_by?: string | null
          estudio_id?: string
          expediente_id?: string | null
          fecha?: string
          id?: string
          monto?: number
          notas?: string | null
          reembolsable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "gastos_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      honorarios: {
        Row: {
          cliente_id: string
          concepto: string
          created_at: string
          created_by: string | null
          estudio_id: string
          expediente_id: string | null
          fecha: string
          id: string
          modalidad: string
          moneda: string
          monto_total: number
          notas: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          concepto: string
          created_at?: string
          created_by?: string | null
          estudio_id: string
          expediente_id?: string | null
          fecha?: string
          id?: string
          modalidad?: string
          moneda?: string
          monto_total?: number
          notas?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          concepto?: string
          created_at?: string
          created_by?: string | null
          estudio_id?: string
          expediente_id?: string | null
          fecha?: string
          id?: string
          modalidad?: string
          moneda?: string
          monto_total?: number
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "honorarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honorarios_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honorarios_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      invitaciones: {
        Row: {
          aceptada_at: string | null
          created_at: string
          email: string
          estudio_id: string
          id: string
          invitado_por: string
          rol: Database["public"]["Enums"]["rol_estudio"]
        }
        Insert: {
          aceptada_at?: string | null
          created_at?: string
          email: string
          estudio_id: string
          id?: string
          invitado_por?: string
          rol?: Database["public"]["Enums"]["rol_estudio"]
        }
        Update: {
          aceptada_at?: string | null
          created_at?: string
          email?: string
          estudio_id?: string
          id?: string
          invitado_por?: string
          rol?: Database["public"]["Enums"]["rol_estudio"]
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes_cliente: {
        Row: {
          autor: string
          autor_id: string | null
          cliente_id: string
          created_at: string
          cuerpo: string
          estudio_id: string
          expediente_id: string | null
          id: string
          leido_at: string | null
          masivo: boolean
        }
        Insert: {
          autor?: string
          autor_id?: string | null
          cliente_id: string
          created_at?: string
          cuerpo: string
          estudio_id: string
          expediente_id?: string | null
          id?: string
          leido_at?: string | null
          masivo?: boolean
        }
        Update: {
          autor?: string
          autor_id?: string | null
          cliente_id?: string
          created_at?: string
          cuerpo?: string
          estudio_id?: string
          expediente_id?: string | null
          id?: string
          leido_at?: string | null
          masivo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_cliente_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_cliente_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          created_at: string
          detalle: string | null
          enlace: string | null
          estudio_id: string
          id: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detalle?: string | null
          enlace?: string | null
          estudio_id: string
          id?: string
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          detalle?: string | null
          enlace?: string | null
          estudio_id?: string
          id?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          created_at: string
          created_by: string | null
          estudio_id: string
          fecha: string
          honorario_id: string
          id: string
          metodo: string
          monto: number
          notas: string | null
          numero_comprobante: string | null
          tipo_comprobante: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          estudio_id: string
          fecha?: string
          honorario_id: string
          id?: string
          metodo?: string
          monto: number
          notas?: string | null
          numero_comprobante?: string | null
          tipo_comprobante?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          estudio_id?: string
          fecha?: string
          honorario_id?: string
          id?: string
          metodo?: string
          monto?: number
          notas?: string | null
          numero_comprobante?: string | null
          tipo_comprobante?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_honorario_id_fkey"
            columns: ["honorario_id"]
            isOneToOne: false
            referencedRelation: "honorarios"
            referencedColumns: ["id"]
          },
        ]
      }
      partes_procesales: {
        Row: {
          abogado: string | null
          created_at: string
          es_cliente: boolean
          estudio_id: string
          expediente_id: string
          id: string
          nombre: string
          numero_documento: string | null
          rol: string
          tipo_documento: Database["public"]["Enums"]["tipo_documento"] | null
        }
        Insert: {
          abogado?: string | null
          created_at?: string
          es_cliente?: boolean
          estudio_id: string
          expediente_id: string
          id?: string
          nombre: string
          numero_documento?: string | null
          rol: string
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"] | null
        }
        Update: {
          abogado?: string | null
          created_at?: string
          es_cliente?: boolean
          estudio_id?: string
          expediente_id?: string
          id?: string
          nombre?: string
          numero_documento?: string | null
          rol?: string
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"] | null
        }
        Relationships: [
          {
            foreignKeyName: "partes_procesales_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partes_procesales_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      plantilla_items: {
        Row: {
          created_at: string
          descripcion: string | null
          dias: number
          dias_habiles: boolean
          duracion_minutos: number
          estudio_id: string
          hora: string
          id: string
          orden: number
          plantilla_id: string
          prioridad: string
          tipo: string
          tipo_evento: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          dias?: number
          dias_habiles?: boolean
          duracion_minutos?: number
          estudio_id: string
          hora?: string
          id?: string
          orden?: number
          plantilla_id: string
          prioridad?: string
          tipo?: string
          tipo_evento?: string
          titulo: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          dias?: number
          dias_habiles?: boolean
          duracion_minutos?: number
          estudio_id?: string
          hora?: string
          id?: string
          orden?: number
          plantilla_id?: string
          prioridad?: string
          tipo?: string
          tipo_evento?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantilla_items_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantilla_items_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string | null
          estudio_id: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          estudio_id: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          estudio_id?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      plazos: {
        Row: {
          asignado_a: string | null
          completado_at: string | null
          created_at: string
          created_by: string | null
          depende_de: string | null
          desfase_dias: number
          dias_habiles: number | null
          estado: string
          estudio_id: string
          expediente_id: string | null
          fecha_notificacion: string | null
          fecha_vencimiento: string
          id: string
          notas: string | null
          parent_id: string | null
          prioridad: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          asignado_a?: string | null
          completado_at?: string | null
          created_at?: string
          created_by?: string | null
          depende_de?: string | null
          desfase_dias?: number
          dias_habiles?: number | null
          estado?: string
          estudio_id: string
          expediente_id?: string | null
          fecha_notificacion?: string | null
          fecha_vencimiento: string
          id?: string
          notas?: string | null
          parent_id?: string | null
          prioridad?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          asignado_a?: string | null
          completado_at?: string | null
          created_at?: string
          created_by?: string | null
          depende_de?: string | null
          desfase_dias?: number
          dias_habiles?: number | null
          estado?: string
          estudio_id?: string
          expediente_id?: string | null
          fecha_notificacion?: string | null
          fecha_vencimiento?: string
          id?: string
          notas?: string | null
          parent_id?: string | null
          prioridad?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plazos_depende_de_fkey"
            columns: ["depende_de"]
            isOneToOne: false
            referencedRelation: "plazos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plazos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "plazos"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_accesos: {
        Row: {
          activo: boolean
          cliente_id: string
          created_at: string
          created_by: string | null
          estudio_id: string
          expira_at: string | null
          id: string
          token: string
          ultimo_acceso: string | null
        }
        Insert: {
          activo?: boolean
          cliente_id: string
          created_at?: string
          created_by?: string | null
          estudio_id: string
          expira_at?: string | null
          id?: string
          token?: string
          ultimo_acceso?: string | null
        }
        Update: {
          activo?: boolean
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          estudio_id?: string
          expira_at?: string | null
          id?: string
          token?: string
          ultimo_acceso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_accesos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_accesos_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          colegiatura: string | null
          created_at: string
          email: string | null
          id: string
          nombre_completo: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          colegiatura?: string | null
          created_at?: string
          email?: string | null
          id: string
          nombre_completo?: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          colegiatura?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre_completo?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registros_tiempo: {
        Row: {
          created_at: string
          descripcion: string
          documento_id: string | null
          en_curso: boolean
          estudio_id: string
          expediente_id: string | null
          facturable: boolean
          fecha: string
          honorario_id: string | null
          id: string
          plazo_id: string | null
          segundos: number
          tarifa_hora: number | null
          ultimo_inicio: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descripcion?: string
          documento_id?: string | null
          en_curso?: boolean
          estudio_id: string
          expediente_id?: string | null
          facturable?: boolean
          fecha?: string
          honorario_id?: string | null
          id?: string
          plazo_id?: string | null
          segundos?: number
          tarifa_hora?: number | null
          ultimo_inicio?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          documento_id?: string | null
          en_curso?: boolean
          estudio_id?: string
          expediente_id?: string | null
          facturable?: boolean
          fecha?: string
          honorario_id?: string | null
          id?: string
          plazo_id?: string | null
          segundos?: number
          tarifa_hora?: number | null
          ultimo_inicio?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_tiempo_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_tiempo_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_tiempo_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_tiempo_honorario_id_fkey"
            columns: ["honorario_id"]
            isOneToOne: false
            referencedRelation: "honorarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_tiempo_plazo_id_fkey"
            columns: ["plazo_id"]
            isOneToOne: false
            referencedRelation: "plazos"
            referencedColumns: ["id"]
          },
        ]
      }
      vistas_guardadas: {
        Row: {
          compartida: boolean
          created_at: string
          estudio_id: string
          filtros: Json
          id: string
          modulo: string
          nombre: string
          user_id: string
        }
        Insert: {
          compartida?: boolean
          created_at?: string
          estudio_id: string
          filtros?: Json
          id?: string
          modulo?: string
          nombre: string
          user_id?: string
        }
        Update: {
          compartida?: boolean
          created_at?: string
          estudio_id?: string
          filtros?: Json
          id?: string
          modulo?: string
          nombre?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistas_guardadas_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceptar_invitacion: { Args: { _invitacion: string }; Returns: string }
      agenda_publica: { Args: { _slug: string }; Returns: Json }
      aplicar_plantilla: {
        Args: { _expediente: string; _items: Json; _plantilla: string }
        Returns: number
      }
      comparte_estudio: { Args: { _user: string }; Returns: boolean }
      crear_estudio: {
        Args: { _departamento?: string; _nombre: string; _ruc?: string }
        Returns: string
      }
      es_miembro: { Args: { _estudio: string }; Returns: boolean }
      facturar_tiempo: {
        Args: {
          _cliente: string
          _concepto: string
          _estudio: string
          _expediente: string
          _registros: string[]
        }
        Returns: string
      }
      mis_avisos: {
        Args: { _estudio: string }
        Returns: {
          clave: string
          detalle: string
          enlace: string
          fecha: string
          tipo: string
          titulo: string
        }[]
      }
      notificar_estudio: {
        Args: {
          _detalle: string
          _enlace: string
          _estudio: string
          _extra: string
          _tipo: string
          _titulo: string
        }
        Returns: undefined
      }
      portal_acceso_valido: {
        Args: { _token: string }
        Returns: {
          activo: boolean
          cliente_id: string
          created_at: string
          created_by: string | null
          estudio_id: string
          expira_at: string | null
          id: string
          token: string
          ultimo_acceso: string | null
        }
        SetofOptions: {
          from: "*"
          to: "portal_accesos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      portal_datos: { Args: { _token: string }; Returns: Json }
      portal_enviar_mensaje: {
        Args: { _cuerpo: string; _expediente: string; _token: string }
        Returns: string
      }
      reservar_cita: {
        Args: {
          _email: string
          _inicio: string
          _motivo: string
          _nombre: string
          _slug: string
          _telefono: string
          _user: string
        }
        Returns: string
      }
      tiene_rol: {
        Args: {
          _estudio: string
          _rol: Database["public"]["Enums"]["rol_estudio"]
        }
        Returns: boolean
      }
    }
    Enums: {
      rol_estudio: "admin" | "abogado" | "asistente"
      tipo_documento: "DNI" | "RUC" | "CE" | "PASAPORTE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      rol_estudio: ["admin", "abogado", "asistente"],
      tipo_documento: ["DNI", "RUC", "CE", "PASAPORTE"],
    },
  },
} as const
