export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          class_id: string | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          class_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          class_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
        ]
      }
      assessment_results: {
        Row: {
          assessment_id: string
          classification: string | null
          created_at: string
          enrollment_id: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          grammar_score: number | null
          id: string
          listening_score: number | null
          overall_score: number | null
          published_at: string | null
          reading_score: number | null
          speaking_score: number | null
          updated_at: string
          vocabulary_score: number | null
          writing_score: number | null
        }
        Insert: {
          assessment_id: string
          classification?: string | null
          created_at?: string
          enrollment_id: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          grammar_score?: number | null
          id?: string
          listening_score?: number | null
          overall_score?: number | null
          published_at?: string | null
          reading_score?: number | null
          speaking_score?: number | null
          updated_at?: string
          vocabulary_score?: number | null
          writing_score?: number | null
        }
        Update: {
          assessment_id?: string
          classification?: string | null
          created_at?: string
          enrollment_id?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          grammar_score?: number | null
          id?: string
          listening_score?: number | null
          overall_score?: number | null
          published_at?: string | null
          reading_score?: number | null
          speaking_score?: number | null
          updated_at?: string
          vocabulary_score?: number | null
          writing_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "assessment_results_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "assessment_results_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_date: string | null
          class_id: string
          created_at: string
          created_by: string
          id: string
          lesson_id: string | null
          max_score: number
          module_id: string | null
          published_at: string | null
          skill_weights: Json | null
          title: string
          type: Database["public"]["Enums"]["assessment_type"]
          updated_at: string
        }
        Insert: {
          assessment_date?: string | null
          class_id: string
          created_at?: string
          created_by: string
          id?: string
          lesson_id?: string | null
          max_score?: number
          module_id?: string | null
          published_at?: string | null
          skill_weights?: Json | null
          title: string
          type: Database["public"]["Enums"]["assessment_type"]
          updated_at?: string
        }
        Update: {
          assessment_date?: string | null
          class_id?: string
          created_at?: string
          created_by?: string
          id?: string
          lesson_id?: string | null
          max_score?: number
          module_id?: string | null
          published_at?: string | null
          skill_weights?: Json | null
          title?: string
          type?: Database["public"]["Enums"]["assessment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "assessments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_attachments: {
        Row: {
          assignment_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          object_path: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          object_path: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          object_path?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_attachments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late_submission: boolean
          class_id: string
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          instructions: string | null
          lesson_id: string | null
          max_attempts: number
          max_score: number
          published_at: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          title: string
          updated_at: string
        }
        Insert: {
          allow_late_submission?: boolean
          class_id: string
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          lesson_id?: string | null
          max_attempts?: number
          max_score?: number
          published_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          title: string
          updated_at?: string
        }
        Update: {
          allow_late_submission?: boolean
          class_id?: string
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          lesson_id?: string | null
          max_attempts?: number
          max_score?: number
          published_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in_at: string | null
          created_at: string
          enrollment_id: string
          id: string
          marked_at: string
          marked_by: string
          note: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          check_in_at?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          marked_at?: string
          marked_by: string
          note?: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          check_in_at?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          marked_at?: string
          marked_by?: string
          note?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          ip: unknown
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip?: unknown
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip?: unknown
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      class_schedules: {
        Row: {
          class_id: string
          created_at: string
          effective_from: string | null
          effective_to: string | null
          end_time: string
          id: string
          start_time: string
          timezone: string
          updated_at: string
          weekday: number
        }
        Insert: {
          class_id: string
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          end_time: string
          id?: string
          start_time: string
          timezone?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          class_id?: string
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          end_time?: string
          id?: string
          start_time?: string
          timezone?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          class_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          lesson_id: string | null
          lesson_log: string | null
          original_session_id: string | null
          schedule_id: string | null
          session_number: number
          starts_at: string
          status: Database["public"]["Enums"]["session_status"]
          teacher_note: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          lesson_id?: string | null
          lesson_log?: string | null
          original_session_id?: string | null
          schedule_id?: string | null
          session_number: number
          starts_at: string
          status?: Database["public"]["Enums"]["session_status"]
          teacher_note?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          lesson_id?: string | null
          lesson_log?: string | null
          original_session_id?: string | null
          schedule_id?: string | null
          session_number?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          teacher_note?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "class_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          assignment_role: Database["public"]["Enums"]["assignment_role"]
          class_id: string
          created_at: string
          id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          assignment_role: Database["public"]["Enums"]["assignment_role"]
          class_id: string
          created_at?: string
          id?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          assignment_role?: Database["public"]["Enums"]["assignment_role"]
          class_id?: string
          created_at?: string
          id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "class_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          address: string | null
          capacity: number
          code: string
          course_id: string
          created_at: string
          created_by: string | null
          delivery_mode: Database["public"]["Enums"]["delivery_mode"]
          expected_end_date: string | null
          id: string
          location_name: string | null
          location_note: string | null
          meeting_url: string | null
          name: string
          planned_session_count: number | null
          session_duration_minutes: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["class_status"]
          target_audience: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          capacity: number
          code: string
          course_id: string
          created_at?: string
          created_by?: string | null
          delivery_mode: Database["public"]["Enums"]["delivery_mode"]
          expected_end_date?: string | null
          id?: string
          location_name?: string | null
          location_note?: string | null
          meeting_url?: string | null
          name: string
          planned_session_count?: number | null
          session_duration_minutes?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["class_status"]
          target_audience?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          capacity?: number
          code?: string
          course_id?: string
          created_at?: string
          created_by?: string | null
          delivery_mode?: Database["public"]["Enums"]["delivery_mode"]
          expected_end_date?: string | null
          id?: string
          location_name?: string | null
          location_note?: string | null
          meeting_url?: string | null
          name?: string
          planned_session_count?: number | null
          session_duration_minutes?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["class_status"]
          target_audience?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          course_id: string
          created_at: string
          id: string
          lesson_id: string | null
          mime_type: string | null
          module_id: string | null
          object_path: string
          size_bytes: number | null
          title: string
          updated_at: string
          uploaded_by: string | null
          visibility: Database["public"]["Enums"]["material_visibility"]
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          mime_type?: string | null
          module_id?: string | null
          object_path: string
          size_bytes?: number | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["material_visibility"]
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          mime_type?: string | null
          module_id?: string | null
          object_path?: string
          size_bytes?: number | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["material_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_index: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          completion_min_attendance_rate: number
          completion_min_overall_score: number
          completion_require_all_assignments: boolean
          course_type: Database["public"]["Enums"]["course_type"]
          created_at: string
          created_by: string | null
          default_session_count: number | null
          default_session_duration_minutes: number | null
          default_tuition_amount: number | null
          description: string | null
          id: string
          level_id: string | null
          objectives: string | null
          status: Database["public"]["Enums"]["course_status"]
          target_audience: string | null
          title: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          code: string
          completion_min_attendance_rate?: number
          completion_min_overall_score?: number
          completion_require_all_assignments?: boolean
          course_type: Database["public"]["Enums"]["course_type"]
          created_at?: string
          created_by?: string | null
          default_session_count?: number | null
          default_session_duration_minutes?: number | null
          default_tuition_amount?: number | null
          description?: string | null
          id?: string
          level_id?: string | null
          objectives?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          target_audience?: string | null
          title: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          completion_min_attendance_rate?: number
          completion_min_overall_score?: number
          completion_require_all_assignments?: boolean
          course_type?: Database["public"]["Enums"]["course_type"]
          created_at?: string
          created_by?: string | null
          default_session_count?: number | null
          default_session_duration_minutes?: number | null
          default_tuition_amount?: number | null
          description?: string | null
          id?: string
          level_id?: string | null
          objectives?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          target_audience?: string | null
          title?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          enrollment_id: string
          id: string
          new_status: Database["public"]["Enums"]["enrollment_status"]
          old_status: Database["public"]["Enums"]["enrollment_status"] | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          enrollment_id: string
          id?: string
          new_status: Database["public"]["Enums"]["enrollment_status"]
          old_status?: Database["public"]["Enums"]["enrollment_status"] | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          enrollment_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["enrollment_status"]
          old_status?: Database["public"]["Enums"]["enrollment_status"] | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_status_history_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_status_history_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "enrollment_status_history_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "enrollment_status_history_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          ended_on: string | null
          enrolled_on: string
          id: string
          reason: string | null
          started_on: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          tuition_override_amount: number | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          enrolled_on?: string
          id?: string
          reason?: string | null
          started_on?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          tuition_override_amount?: number | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          enrolled_on?: string
          id?: string
          reason?: string | null
          started_on?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
          tuition_override_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_scale_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          max_score: number
          min_score: number
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          max_score: number
          min_score: number
          order_index: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          max_score?: number
          min_score?: number
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      learning_evaluations: {
        Row: {
          action_plan: string | null
          areas_for_improvement: string | null
          created_at: string
          created_by: string
          enrollment_id: string
          evaluation_date: string
          grammar_rating:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          id: string
          listening_rating:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          overall_rating:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          period_end: string | null
          period_start: string | null
          published_at: string | null
          reading_rating:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          speaking_rating:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          strengths: string | null
          teacher_comment: string | null
          updated_at: string
          visible_to_student: boolean
          vocabulary_rating:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          writing_rating:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
        }
        Insert: {
          action_plan?: string | null
          areas_for_improvement?: string | null
          created_at?: string
          created_by: string
          enrollment_id: string
          evaluation_date?: string
          grammar_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          id?: string
          listening_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          overall_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          reading_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          speaking_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          strengths?: string | null
          teacher_comment?: string | null
          updated_at?: string
          visible_to_student?: boolean
          vocabulary_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          writing_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
        }
        Update: {
          action_plan?: string | null
          areas_for_improvement?: string | null
          created_at?: string
          created_by?: string
          enrollment_id?: string
          evaluation_date?: string
          grammar_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          id?: string
          listening_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          overall_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          reading_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          speaking_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          strengths?: string | null
          teacher_comment?: string | null
          updated_at?: string
          visible_to_student?: boolean
          vocabulary_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
          writing_rating?:
            | Database["public"]["Enums"]["evaluation_rating"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_evaluations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_evaluations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "learning_evaluations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "learning_evaluations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          enrollment_id: string
          id: string
          lesson_id: string
          status: Database["public"]["Enums"]["lesson_progress_status"]
          teacher_note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          lesson_id: string
          status?: Database["public"]["Enums"]["lesson_progress_status"]
          teacher_note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          lesson_id?: string
          status?: Database["public"]["Enums"]["lesson_progress_status"]
          teacher_note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content_summary: string | null
          created_at: string
          id: string
          module_id: string
          objectives: string | null
          order_index: number
          planned_duration_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          content_summary?: string | null
          created_at?: string
          id?: string
          module_id: string
          objectives?: string | null
          order_index: number
          planned_duration_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          content_summary?: string | null
          created_at?: string
          id?: string
          module_id?: string
          objectives?: string | null
          order_index?: number
          planned_duration_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          code: string
          created_at: string
          description: string | null
          framework: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          framework?: string
          id?: string
          is_active?: boolean
          name: string
          order_index: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          framework?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          link: string | null
          read_at: string | null
          resource_id: string | null
          resource_type: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      student_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string
          enrollment_id: string
          id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["note_visibility"]
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          enrollment_id: string
          id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          enrollment_id?: string
          id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "student_notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          archived_at: string | null
          created_at: string
          current_level_id: string | null
          dob: string | null
          email: string | null
          full_name: string
          gender: string | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relation: string | null
          id: string
          joined_on: string
          learning_goal: string | null
          note: string | null
          phone: string | null
          status: string
          student_code: string
          target_level_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          current_level_id?: string | null
          dob?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relation?: string | null
          id?: string
          joined_on?: string
          learning_goal?: string | null
          note?: string | null
          phone?: string | null
          status?: string
          student_code: string
          target_level_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          current_level_id?: string | null
          dob?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relation?: string | null
          id?: string
          joined_on?: string
          learning_goal?: string | null
          note?: string | null
          phone?: string | null
          status?: string
          student_code?: string
          target_level_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_students_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_current_level_id_fkey"
            columns: ["current_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_target_level_id_fkey"
            columns: ["target_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          object_path: string
          size_bytes: number | null
          submission_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          object_path: string
          size_bytes?: number | null
          submission_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          object_path?: string
          size_bytes?: number | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          attempt_no: number
          created_at: string
          enrollment_id: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_late: boolean
          score: number | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          text_answer: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          attempt_no?: number
          created_at?: string
          enrollment_id: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_late?: boolean
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          text_answer?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          attempt_no?: number
          created_at?: string
          enrollment_id?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_late?: boolean
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          text_answer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      teachers: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          is_active: boolean
          specialization: string | null
          teacher_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          specialization?: string | null
          teacher_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          specialization?: string | null
          teacher_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_teachers_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          unit_amount: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total: number
          quantity?: number
          unit_amount: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "tuition_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "tuition_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_tuition_balance"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      tuition_invoices: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          discount: number
          due_date: string | null
          enrollment_id: string | null
          id: string
          invoice_code: string
          issue_date: string
          note: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          invoice_code: string
          issue_date?: string
          note?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          invoice_code?: string
          issue_date?: string
          note?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_invoices_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_invoices_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "tuition_invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "tuition_invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "tuition_invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "tuition_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          payment_code: string
          recorded_by: string
          reference: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          payment_code: string
          recorded_by: string
          reference?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          payment_code?: string
          recorded_by?: string
          reference?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "tuition_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_tuition_balance"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "tuition_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_receipts: {
        Row: {
          created_at: string
          id: string
          issued_at: string
          issued_by: string | null
          object_path: string | null
          payment_id: string
          receipt_code: string
          snapshot: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          object_path?: string | null
          payment_id: string
          receipt_code: string
          snapshot?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          object_path?: string | null
          payment_id?: string
          receipt_code?: string
          snapshot?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "tuition_payments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_at_risk_students: {
        Row: {
          attendance_rate: number | null
          avg_score: number | null
          class_id: string | null
          class_name: string | null
          enrollment_id: string | null
          full_name: string | null
          missing_assignments: number | null
          progress_percent: number | null
          risk_reasons: string[] | null
          student_code: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      v_class_progress: {
        Row: {
          active_students: number | null
          avg_attendance_rate: number | null
          avg_progress_percent: number | null
          avg_score: number | null
          capacity: number | null
          class_code: string | null
          class_id: string | null
          class_name: string | null
          completed_students: number | null
          status: Database["public"]["Enums"]["class_status"] | null
        }
        Relationships: []
      }
      v_enrollment_progress: {
        Row: {
          attendance_rate: number | null
          avg_score: number | null
          class_id: string | null
          completed_lessons: number | null
          completion_min_attendance_rate: number | null
          completion_min_overall_score: number | null
          completion_require_all_assignments: boolean | null
          course_id: string | null
          enrollment_id: string | null
          enrollment_status:
            | Database["public"]["Enums"]["enrollment_status"]
            | null
          is_completion_ready: boolean | null
          progress_percent: number | null
          student_id: string | null
          submitted_assignments: number | null
          total_assignments: number | null
          total_lessons: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      v_student_attendance_summary: {
        Row: {
          absent_count: number | null
          attendance_rate: number | null
          class_id: string | null
          enrollment_id: string | null
          excused_count: number | null
          late_count: number | null
          present_count: number | null
          student_id: string | null
          total_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tuition_balance: {
        Row: {
          balance: number | null
          class_id: string | null
          due_date: string | null
          enrollment_id: string | null
          invoice_code: string | null
          invoice_id: string | null
          is_overdue: boolean | null
          issue_date: string | null
          paid_amount: number | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          student_id: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tuition_invoices_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_invoices_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "tuition_invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "tuition_invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "tuition_invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "tuition_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bulk_mark_attendance: {
        Args: { p_records: Json; p_session_id: string }
        Returns: number
      }
      change_enrollment_status: {
        Args: {
          p_enrollment_id: string
          p_new_status: Database["public"]["Enums"]["enrollment_status"]
          p_reason?: string
        }
        Returns: undefined
      }
      close_assignment: { Args: { p_assignment_id: string }; Returns: Json }
      consume_rate_limit: { Args: { p_scope: string }; Returns: boolean }
      delete_tuition_invoice_draft: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      enroll_student: {
        Args: {
          p_class_id: string
          p_reason?: string
          p_status?: Database["public"]["Enums"]["enrollment_status"]
          p_student_id: string
        }
        Returns: string
      }
      expire_announcement: {
        Args: { p_announcement_id: string }
        Returns: undefined
      }
      generate_class_sessions: { Args: { p_class_id: string }; Returns: number }
      grade_submission: {
        Args: { p_feedback?: string; p_score: number; p_submission_id: string }
        Returns: Json
      }
      issue_tuition_invoice: { Args: { p_invoice_id: string }; Returns: Json }
      log_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: undefined
      }
      publish_announcement: {
        Args: { p_announcement_id: string }
        Returns: number
      }
      publish_assessment_results: {
        Args: { p_assessment_id: string }
        Returns: number
      }
      publish_assignment: { Args: { p_assignment_id: string }; Returns: Json }
      publish_evaluation: { Args: { p_evaluation_id: string }; Returns: Json }
      record_tuition_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_note?: string
          p_paid_at?: string
          p_reference?: string
        }
        Returns: string
      }
      run_assignment_due_reminders: { Args: { p_now?: string }; Returns: Json }
      run_invoice_overdue: { Args: { p_now?: string }; Returns: Json }
      run_session_reminders: { Args: { p_now?: string }; Returns: Json }
      save_announcement: {
        Args: {
          p_announcement_id?: string
          p_body: string
          p_class_id?: string
          p_expires_at?: string
          p_title: string
        }
        Returns: string
      }
      save_assessment_result: {
        Args: {
          p_assessment_id: string
          p_enrollment_id: string
          p_feedback?: string
          p_grammar_score?: number
          p_listening_score?: number
          p_overall_score?: number
          p_reading_score?: number
          p_speaking_score?: number
          p_vocabulary_score?: number
          p_writing_score?: number
        }
        Returns: Json
      }
      save_session_log: {
        Args: {
          p_complete: boolean
          p_lesson_id: string
          p_lesson_log: string
          p_session_id: string
          p_teacher_note: string
        }
        Returns: number
      }
      save_tuition_invoice: {
        Args: {
          p_discount: number
          p_due_date?: string
          p_enrollment_id?: string
          p_invoice_id?: string
          p_issue_date: string
          p_items: Json
          p_note?: string
          p_student_id: string
        }
        Returns: string
      }
      transfer_enrollment: {
        Args: {
          p_enrollment_id: string
          p_reason?: string
          p_to_class_id: string
        }
        Returns: string
      }
    }
    Enums: {
      assessment_type:
        | "quiz"
        | "midterm"
        | "final"
        | "mock_hsk"
        | "speaking"
        | "custom"
      assignment_role: "primary" | "assistant"
      assignment_status: "draft" | "published" | "closed"
      attendance_status: "present" | "late" | "absent" | "excused"
      class_status: "planned" | "active" | "paused" | "completed" | "cancelled"
      course_status: "draft" | "active" | "archived"
      course_type:
        | "hsk"
        | "communication"
        | "kids"
        | "exam_prep"
        | "business_custom"
        | "custom"
      delivery_mode: "offline" | "online" | "hybrid" | "in_house"
      enrollment_status:
        | "pending"
        | "active"
        | "paused"
        | "completed"
        | "withdrawn"
        | "transferred"
      evaluation_rating: "weak" | "average" | "good" | "excellent"
      invoice_status:
        | "draft"
        | "issued"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
        | "refunded"
      lesson_progress_status: "not_started" | "in_progress" | "completed"
      material_visibility: "staff_only" | "enrolled_students"
      note_visibility: "staff_only" | "student_visible"
      notification_type:
        | "session_upcoming"
        | "session_changed"
        | "assignment_new"
        | "assignment_due"
        | "assessment_upcoming"
        | "result_published"
        | "attendance_absent"
        | "invoice_new"
        | "invoice_due"
        | "invoice_overdue"
        | "announcement"
      payment_method: "cash" | "bank_transfer" | "card" | "e_wallet" | "other"
      session_status: "scheduled" | "completed" | "cancelled" | "rescheduled"
      submission_status: "submitted" | "graded" | "returned"
      user_role: "super_admin" | "teacher" | "student"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      assessment_type: [
        "quiz",
        "midterm",
        "final",
        "mock_hsk",
        "speaking",
        "custom",
      ],
      assignment_role: ["primary", "assistant"],
      assignment_status: ["draft", "published", "closed"],
      attendance_status: ["present", "late", "absent", "excused"],
      class_status: ["planned", "active", "paused", "completed", "cancelled"],
      course_status: ["draft", "active", "archived"],
      course_type: [
        "hsk",
        "communication",
        "kids",
        "exam_prep",
        "business_custom",
        "custom",
      ],
      delivery_mode: ["offline", "online", "hybrid", "in_house"],
      enrollment_status: [
        "pending",
        "active",
        "paused",
        "completed",
        "withdrawn",
        "transferred",
      ],
      evaluation_rating: ["weak", "average", "good", "excellent"],
      invoice_status: [
        "draft",
        "issued",
        "partial",
        "paid",
        "overdue",
        "cancelled",
        "refunded",
      ],
      lesson_progress_status: ["not_started", "in_progress", "completed"],
      material_visibility: ["staff_only", "enrolled_students"],
      note_visibility: ["staff_only", "student_visible"],
      notification_type: [
        "session_upcoming",
        "session_changed",
        "assignment_new",
        "assignment_due",
        "assessment_upcoming",
        "result_published",
        "attendance_absent",
        "invoice_new",
        "invoice_due",
        "invoice_overdue",
        "announcement",
      ],
      payment_method: ["cash", "bank_transfer", "card", "e_wallet", "other"],
      session_status: ["scheduled", "completed", "cancelled", "rescheduled"],
      submission_status: ["submitted", "graded", "returned"],
      user_role: ["super_admin", "teacher", "student"],
    },
  },
} as const

