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
            referencedRelation: "v_class_assessment_progress"
            referencedColumns: ["class_id"]
          },
        ]
      }
      answer_media: {
        Row: {
          attempt_id: string
          attempt_kind: Database["public"]["Enums"]["question_set_kind"]
          created_at: string
          duration_ms: number | null
          id: string
          mime_type: string
          object_path: string
          set_item_id: string
          size_bytes: number
          uploaded_by: string
        }
        Insert: {
          attempt_id: string
          attempt_kind: Database["public"]["Enums"]["question_set_kind"]
          created_at?: string
          duration_ms?: number | null
          id?: string
          mime_type: string
          object_path: string
          set_item_id: string
          size_bytes: number
          uploaded_by?: string
        }
        Update: {
          attempt_id?: string
          attempt_kind?: Database["public"]["Enums"]["question_set_kind"]
          created_at?: string
          duration_ms?: number | null
          id?: string
          mime_type?: string
          object_path?: string
          set_item_id?: string
          size_bytes?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_media_set_item_id_fkey"
            columns: ["set_item_id"]
            isOneToOne: false
            referencedRelation: "question_set_items"
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
            referencedRelation: "v_at_risk_assessment_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_assessment_progress"
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
            referencedRelation: "v_class_assessment_progress"
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
            referencedRelation: "v_class_assessment_progress"
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
          class_id: string
          created_at: string
          id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
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
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "v_class_assessment_progress"
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
          code?: string
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
          completion_require_all_exercises: boolean
          course_type: Database["public"]["Enums"]["course_type"] | null
          created_at: string
          created_by: string | null
          default_session_count: number | null
          default_session_duration_minutes: number | null
          default_tuition_amount: number | null
          description: string | null
          id: string
          level_id: string | null
          objectives: string | null
          program: Database["public"]["Enums"]["course_program"]
          status: Database["public"]["Enums"]["course_status"]
          target_audience: string | null
          title: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          code?: string
          completion_min_attendance_rate?: number
          completion_min_overall_score?: number
          completion_require_all_exercises?: boolean
          course_type?: Database["public"]["Enums"]["course_type"] | null
          created_at?: string
          created_by?: string | null
          default_session_count?: number | null
          default_session_duration_minutes?: number | null
          default_tuition_amount?: number | null
          description?: string | null
          id?: string
          level_id?: string | null
          objectives?: string | null
          program?: Database["public"]["Enums"]["course_program"]
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
          completion_require_all_exercises?: boolean
          course_type?: Database["public"]["Enums"]["course_type"] | null
          created_at?: string
          created_by?: string | null
          default_session_count?: number | null
          default_session_duration_minutes?: number | null
          default_tuition_amount?: number | null
          description?: string | null
          id?: string
          level_id?: string | null
          objectives?: string | null
          program?: Database["public"]["Enums"]["course_program"]
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
            referencedRelation: "v_at_risk_assessment_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "enrollment_status_history_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_assessment_progress"
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
            referencedRelation: "v_class_assessment_progress"
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
      exam_answers: {
        Row: {
          answer_payload: Json
          attempt_id: string
          auto_score: number | null
          feedback: string | null
          final_score: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_correct: boolean | null
          manual_score: number | null
          override_reason: string | null
          saved_at: string
          set_item_id: string
        }
        Insert: {
          answer_payload?: Json
          attempt_id: string
          auto_score?: number | null
          feedback?: string | null
          final_score?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_correct?: boolean | null
          manual_score?: number | null
          override_reason?: string | null
          saved_at?: string
          set_item_id: string
        }
        Update: {
          answer_payload?: Json
          attempt_id?: string
          auto_score?: number | null
          feedback?: string | null
          final_score?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_correct?: boolean | null
          manual_score?: number | null
          override_reason?: string | null
          saved_at?: string
          set_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_set_item_id_fkey"
            columns: ["set_item_id"]
            isOneToOne: false
            referencedRelation: "question_set_items"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          classification_rule_id: string | null
          created_at: string
          deadline_at: string
          enrollment_id: string
          exam_delivery_id: string
          final_score_100: number | null
          graded_at: string | null
          id: string
          invalidated_at: string | null
          invalidated_reason: string | null
          raw_score: number | null
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          submission_reason:
            | Database["public"]["Enums"]["submission_reason"]
            | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          classification_rule_id?: string | null
          created_at?: string
          deadline_at: string
          enrollment_id: string
          exam_delivery_id: string
          final_score_100?: number | null
          graded_at?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          raw_score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submission_reason?:
            | Database["public"]["Enums"]["submission_reason"]
            | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          classification_rule_id?: string | null
          created_at?: string
          deadline_at?: string
          enrollment_id?: string
          exam_delivery_id?: string
          final_score_100?: number | null
          graded_at?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          raw_score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submission_reason?:
            | Database["public"]["Enums"]["submission_reason"]
            | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_classification_rule_id_fkey"
            columns: ["classification_rule_id"]
            isOneToOne: false
            referencedRelation: "grading_scale_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_assessment_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "exam_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_assessment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "exam_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "exam_attempts_exam_delivery_id_fkey"
            columns: ["exam_delivery_id"]
            isOneToOne: false
            referencedRelation: "exam_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_deliveries: {
        Row: {
          answer_release_mode: Database["public"]["Enums"]["answer_release_mode"]
          class_id: string
          closes_at: string
          created_at: string
          created_by: string
          duration_minutes: number
          exam_type: Database["public"]["Enums"]["assessment_type"]
          id: string
          opens_at: string
          passing_score: number | null
          published_at: string | null
          results_published_at: string | null
          set_version_id: string
          status: Database["public"]["Enums"]["exam_delivery_status"]
          title: string
          updated_at: string
        }
        Insert: {
          answer_release_mode?: Database["public"]["Enums"]["answer_release_mode"]
          class_id: string
          closes_at: string
          created_at?: string
          created_by?: string
          duration_minutes: number
          exam_type?: Database["public"]["Enums"]["assessment_type"]
          id?: string
          opens_at: string
          passing_score?: number | null
          published_at?: string | null
          results_published_at?: string | null
          set_version_id: string
          status?: Database["public"]["Enums"]["exam_delivery_status"]
          title: string
          updated_at?: string
        }
        Update: {
          answer_release_mode?: Database["public"]["Enums"]["answer_release_mode"]
          class_id?: string
          closes_at?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          exam_type?: Database["public"]["Enums"]["assessment_type"]
          id?: string
          opens_at?: string
          passing_score?: number | null
          published_at?: string | null
          results_published_at?: string | null
          set_version_id?: string
          status?: Database["public"]["Enums"]["exam_delivery_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_deliveries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_deliveries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_assessment_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "exam_deliveries_set_version_id_fkey"
            columns: ["set_version_id"]
            isOneToOne: false
            referencedRelation: "question_set_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_integrity_events: {
        Row: {
          attempt_id: string
          client_context: Json
          event_type: string
          id: string
          occurred_at: string
        }
        Insert: {
          attempt_id: string
          client_context?: Json
          event_type: string
          id?: string
          occurred_at?: string
        }
        Update: {
          attempt_id?: string
          client_context?: Json
          event_type?: string
          id?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_integrity_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_regrade_runs: {
        Row: {
          changed_attempt_count: number
          completed_at: string | null
          exam_delivery_id: string
          id: string
          reason: string
          rule_override: Json
          started_at: string
          started_by: string
          status: string
        }
        Insert: {
          changed_attempt_count?: number
          completed_at?: string | null
          exam_delivery_id: string
          id?: string
          reason: string
          rule_override: Json
          started_at?: string
          started_by?: string
          status?: string
        }
        Update: {
          changed_attempt_count?: number
          completed_at?: string | null
          exam_delivery_id?: string
          id?: string
          reason?: string
          rule_override?: Json
          started_at?: string
          started_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_regrade_runs_exam_delivery_id_fkey"
            columns: ["exam_delivery_id"]
            isOneToOne: false
            referencedRelation: "exam_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_answers: {
        Row: {
          answer_payload: Json
          attempt_id: string
          auto_score: number | null
          feedback: string | null
          final_score: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_correct: boolean | null
          manual_score: number | null
          override_reason: string | null
          saved_at: string
          set_item_id: string
        }
        Insert: {
          answer_payload?: Json
          attempt_id: string
          auto_score?: number | null
          feedback?: string | null
          final_score?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_correct?: boolean | null
          manual_score?: number | null
          override_reason?: string | null
          saved_at?: string
          set_item_id: string
        }
        Update: {
          answer_payload?: Json
          attempt_id?: string
          auto_score?: number | null
          feedback?: string | null
          final_score?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_correct?: boolean | null
          manual_score?: number | null
          override_reason?: string | null
          saved_at?: string
          set_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exercise_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_answers_set_item_id_fkey"
            columns: ["set_item_id"]
            isOneToOne: false
            referencedRelation: "question_set_items"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_attempts: {
        Row: {
          attempt_no: number
          created_at: string
          delivery_id: string
          enrollment_id: string
          final_score: number | null
          graded_at: string | null
          id: string
          invalidated_at: string | null
          invalidated_reason: string | null
          is_late: boolean
          raw_score: number | null
          results_published_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          attempt_no: number
          created_at?: string
          delivery_id: string
          enrollment_id: string
          final_score?: number | null
          graded_at?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          is_late?: boolean
          raw_score?: number | null
          results_published_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          attempt_no?: number
          created_at?: string
          delivery_id?: string
          enrollment_id?: string
          final_score?: number | null
          graded_at?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          is_late?: boolean
          raw_score?: number | null
          results_published_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_attempts_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "exercise_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_at_risk_assessment_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "exercise_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_assessment_progress"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "exercise_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_student_attendance_summary"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      exercise_deliveries: {
        Row: {
          allow_late_submission: boolean
          answer_release_mode: Database["public"]["Enums"]["answer_release_mode"]
          attempt_limit: number
          available_from: string
          class_id: string
          created_at: string
          created_by: string
          due_at: string
          grading_method: Database["public"]["Enums"]["exercise_grading_method"]
          id: string
          instructions: string | null
          late_penalty_percent: number
          max_score: number
          published_at: string | null
          result_release_mode: Database["public"]["Enums"]["result_release_mode"]
          set_version_id: string
          status: Database["public"]["Enums"]["exercise_delivery_status"]
          title: string
          updated_at: string
        }
        Insert: {
          allow_late_submission?: boolean
          answer_release_mode?: Database["public"]["Enums"]["answer_release_mode"]
          attempt_limit?: number
          available_from: string
          class_id: string
          created_at?: string
          created_by?: string
          due_at: string
          grading_method?: Database["public"]["Enums"]["exercise_grading_method"]
          id?: string
          instructions?: string | null
          late_penalty_percent?: number
          max_score: number
          published_at?: string | null
          result_release_mode?: Database["public"]["Enums"]["result_release_mode"]
          set_version_id: string
          status?: Database["public"]["Enums"]["exercise_delivery_status"]
          title: string
          updated_at?: string
        }
        Update: {
          allow_late_submission?: boolean
          answer_release_mode?: Database["public"]["Enums"]["answer_release_mode"]
          attempt_limit?: number
          available_from?: string
          class_id?: string
          created_at?: string
          created_by?: string
          due_at?: string
          grading_method?: Database["public"]["Enums"]["exercise_grading_method"]
          id?: string
          instructions?: string | null
          late_penalty_percent?: number
          max_score?: number
          published_at?: string | null
          result_release_mode?: Database["public"]["Enums"]["result_release_mode"]
          set_version_id?: string
          status?: Database["public"]["Enums"]["exercise_delivery_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_deliveries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_deliveries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "v_class_assessment_progress"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "exercise_deliveries_set_version_id_fkey"
            columns: ["set_version_id"]
            isOneToOne: false
            referencedRelation: "question_set_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_decks: {
        Row: {
          course_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          published_at: string | null
          status: Database["public"]["Enums"]["flashcard_status"]
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["flashcard_status"]
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["flashcard_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_decks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_pages: {
        Row: {
          archived_at: string | null
          audio_path: string
          back_alt: string
          back_image_path: string
          created_at: string
          created_by: string
          front_alt: string
          front_image_path: string
          id: string
          kind: Database["public"]["Enums"]["flashcard_page_kind"]
          order_index: number
          section_id: string
          term: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          audio_path: string
          back_alt: string
          back_image_path: string
          created_at?: string
          created_by?: string
          front_alt: string
          front_image_path: string
          id?: string
          kind: Database["public"]["Enums"]["flashcard_page_kind"]
          order_index: number
          section_id: string
          term?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          audio_path?: string
          back_alt?: string
          back_image_path?: string
          created_at?: string
          created_by?: string
          front_alt?: string
          front_image_path?: string
          id?: string
          kind?: Database["public"]["Enums"]["flashcard_page_kind"]
          order_index?: number
          section_id?: string
          term?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_pages_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "flashcard_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_sections: {
        Row: {
          created_at: string
          created_by: string
          deck_id: string
          id: string
          published_at: string | null
          session_number: number
          status: Database["public"]["Enums"]["flashcard_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          deck_id: string
          id?: string
          published_at?: string | null
          session_number: number
          status?: Database["public"]["Enums"]["flashcard_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deck_id?: string
          id?: string
          published_at?: string | null
          session_number?: number
          status?: Database["public"]["Enums"]["flashcard_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_sections_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
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
            referencedRelation: "v_at_risk_assessment_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "learning_evaluations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_assessment_progress"
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
            referencedRelation: "v_at_risk_assessment_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_assessment_progress"
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
          username: string | null
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
          username?: string | null
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
          username?: string | null
        }
        Relationships: []
      }
      question_answer_keys: {
        Row: {
          answer_key: Json
          created_at: string
          created_by: string
          grading_config: Json
          question_version_id: string
          updated_at: string
        }
        Insert: {
          answer_key: Json
          created_at?: string
          created_by?: string
          grading_config?: Json
          question_version_id: string
          updated_at?: string
        }
        Update: {
          answer_key?: Json
          created_at?: string
          created_by?: string
          grading_config?: Json
          question_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_answer_keys_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: true
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_collections: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_collections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_collections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "question_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      question_media: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: string
          media_role: string
          mime_type: string
          object_path: string
          question_version_id: string
          size_bytes: number
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          media_role: string
          mime_type: string
          object_path: string
          question_version_id: string
          size_bytes: number
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          media_role?: string
          mime_type?: string
          object_path?: string
          question_version_id?: string
          size_bytes?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_media_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          content: string
          id: string
          option_key: string
          order_index: number
          question_version_id: string
        }
        Insert: {
          content: string
          id?: string
          option_key: string
          order_index: number
          question_version_id: string
        }
        Update: {
          content?: string
          id?: string
          option_key?: string
          order_index?: number
          question_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_review_requests: {
        Row: {
          id: string
          question_id: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
        }
        Insert: {
          id?: string
          question_id: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
        }
        Update: {
          id?: string
          question_id?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_review_requests_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_set_items: {
        Row: {
          display_config: Json
          id: string
          order_index: number
          points: number
          question_version_id: string
          required: boolean
          section_id: string | null
          set_version_id: string
        }
        Insert: {
          display_config?: Json
          id?: string
          order_index: number
          points: number
          question_version_id: string
          required?: boolean
          section_id?: string | null
          set_version_id: string
        }
        Update: {
          display_config?: Json
          id?: string
          order_index?: number
          points?: number
          question_version_id?: string
          required?: boolean
          section_id?: string | null
          set_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_set_items_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_set_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "question_set_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_set_items_set_version_id_fkey"
            columns: ["set_version_id"]
            isOneToOne: false
            referencedRelation: "question_set_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_set_sections: {
        Row: {
          id: string
          instructions: string | null
          order_index: number
          set_version_id: string
          stimulus_config: Json
          title: string
        }
        Insert: {
          id?: string
          instructions?: string | null
          order_index: number
          set_version_id: string
          stimulus_config?: Json
          title: string
        }
        Update: {
          id?: string
          instructions?: string | null
          order_index?: number
          set_version_id?: string
          stimulus_config?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_set_sections_set_version_id_fkey"
            columns: ["set_version_id"]
            isOneToOne: false
            referencedRelation: "question_set_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_set_shares: {
        Row: {
          created_at: string
          permission: Database["public"]["Enums"]["question_share_permission"]
          question_set_id: string
          shared_by: string
          shared_with_teacher_id: string
        }
        Insert: {
          created_at?: string
          permission?: Database["public"]["Enums"]["question_share_permission"]
          question_set_id: string
          shared_by?: string
          shared_with_teacher_id: string
        }
        Update: {
          created_at?: string
          permission?: Database["public"]["Enums"]["question_share_permission"]
          question_set_id?: string
          shared_by?: string
          shared_with_teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_set_shares_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_set_shares_shared_with_teacher_id_fkey"
            columns: ["shared_with_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      question_set_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          instructions_snapshot: string | null
          locked_at: string | null
          question_set_id: string
          raw_max_score: number
          rubric_config: Json
          title_snapshot: string
          version_no: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          instructions_snapshot?: string | null
          locked_at?: string | null
          question_set_id: string
          raw_max_score?: number
          rubric_config?: Json
          title_snapshot: string
          version_no: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          instructions_snapshot?: string | null
          locked_at?: string | null
          question_set_id?: string
          raw_max_score?: number
          rubric_config?: Json
          title_snapshot?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_set_versions_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      question_sets: {
        Row: {
          course_id: string | null
          created_at: string
          current_version_id: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["question_set_kind"]
          lesson_id: string | null
          module_id: string | null
          owner_id: string
          status: Database["public"]["Enums"]["question_set_status"]
          title: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          current_version_id?: string | null
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["question_set_kind"]
          lesson_id?: string | null
          module_id?: string | null
          owner_id: string
          status?: Database["public"]["Enums"]["question_set_status"]
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          current_version_id?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["question_set_kind"]
          lesson_id?: string | null
          module_id?: string | null
          owner_id?: string
          status?: Database["public"]["Enums"]["question_set_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_question_sets_current_version"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "question_set_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_shares: {
        Row: {
          created_at: string
          permission: Database["public"]["Enums"]["question_share_permission"]
          question_id: string
          shared_by: string
          shared_with_teacher_id: string
        }
        Insert: {
          created_at?: string
          permission?: Database["public"]["Enums"]["question_share_permission"]
          question_id: string
          shared_by?: string
          shared_with_teacher_id: string
        }
        Update: {
          created_at?: string
          permission?: Database["public"]["Enums"]["question_share_permission"]
          question_id?: string
          shared_by?: string
          shared_with_teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_shares_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_shares_shared_with_teacher_id_fkey"
            columns: ["shared_with_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      question_tag_links: {
        Row: {
          question_id: string
          tag_id: string
        }
        Insert: {
          question_id: string
          tag_id: string
        }
        Update: {
          question_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_tag_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "question_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      question_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_tags_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_versions: {
        Row: {
          created_at: string
          created_by: string
          explanation_text: string | null
          id: string
          normalization_config: Json
          prompt_content: Json
          prompt_text: string
          question_id: string
          question_type: Database["public"]["Enums"]["question_type"]
          version_no: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          explanation_text?: string | null
          id?: string
          normalization_config?: Json
          prompt_content?: Json
          prompt_text: string
          question_id: string
          question_type: Database["public"]["Enums"]["question_type"]
          version_no: number
        }
        Update: {
          created_at?: string
          created_by?: string
          explanation_text?: string | null
          id?: string
          normalization_config?: Json
          prompt_content?: Json
          prompt_text?: string
          question_id?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_versions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          archived_at: string | null
          code: string
          collection_id: string | null
          course_id: string | null
          created_at: string
          created_by: string
          current_version_id: string | null
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          id: string
          lesson_id: string | null
          module_id: string | null
          owner_id: string
          skill: Database["public"]["Enums"]["question_skill"]
          status: Database["public"]["Enums"]["question_status"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["question_visibility"]
        }
        Insert: {
          archived_at?: string | null
          code?: string
          collection_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string
          current_version_id?: string | null
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          owner_id: string
          skill: Database["public"]["Enums"]["question_skill"]
          status?: Database["public"]["Enums"]["question_status"]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["question_visibility"]
        }
        Update: {
          archived_at?: string | null
          code?: string
          collection_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string
          current_version_id?: string | null
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          owner_id?: string
          skill?: Database["public"]["Enums"]["question_skill"]
          status?: Database["public"]["Enums"]["question_status"]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["question_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_questions_current_version"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "question_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "v_at_risk_assessment_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "student_notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_assessment_progress"
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
          student_code?: string
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
          teacher_code?: string
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
            referencedRelation: "v_class_assessment_progress"
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
            referencedRelation: "v_at_risk_assessment_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "tuition_invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_assessment_progress"
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
      wrong_answer_queue: {
        Row: {
          created_at: string
          first_seen_at: string
          id: string
          last_seen_at: string
          question_version_id: string
          resolved_at: string | null
          source_kind: Database["public"]["Enums"]["question_set_kind"]
          source_set_item_id: string
          student_id: string
          updated_at: string
          wrong_count: number
        }
        Insert: {
          created_at?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          question_version_id: string
          resolved_at?: string | null
          source_kind: Database["public"]["Enums"]["question_set_kind"]
          source_set_item_id: string
          student_id: string
          updated_at?: string
          wrong_count?: number
        }
        Update: {
          created_at?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          question_version_id?: string
          resolved_at?: string | null
          source_kind?: Database["public"]["Enums"]["question_set_kind"]
          source_set_item_id?: string
          student_id?: string
          updated_at?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "wrong_answer_queue_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_answer_queue_source_set_item_id_fkey"
            columns: ["source_set_item_id"]
            isOneToOne: false
            referencedRelation: "question_set_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_answer_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      wrong_answer_review_attempts: {
        Row: {
          answer_payload: Json
          attempted_at: string
          id: string
          is_correct: boolean
          queue_id: string
          score: number | null
        }
        Insert: {
          answer_payload: Json
          attempted_at?: string
          id?: string
          is_correct: boolean
          queue_id: string
          score?: number | null
        }
        Update: {
          answer_payload?: Json
          attempted_at?: string
          id?: string
          is_correct?: boolean
          queue_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wrong_answer_review_attempts_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "wrong_answer_queue"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_at_risk_assessment_students: {
        Row: {
          attendance_rate: number | null
          avg_score: number | null
          class_id: string | null
          class_name: string | null
          enrollment_id: string | null
          full_name: string | null
          missing_exercises: number | null
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
            referencedRelation: "v_class_assessment_progress"
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
      v_class_assessment_progress: {
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
      v_enrollment_assessment_progress: {
        Row: {
          attendance_rate: number | null
          avg_score: number | null
          class_id: string | null
          completed_lessons: number | null
          completion_min_attendance_rate: number | null
          completion_min_overall_score: number | null
          completion_require_all_exercises: boolean | null
          course_id: string | null
          enrollment_id: string | null
          enrollment_status:
            | Database["public"]["Enums"]["enrollment_status"]
            | null
          is_completion_ready: boolean | null
          progress_percent: number | null
          student_id: string | null
          submitted_exercises: number | null
          total_exercises: number | null
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
            referencedRelation: "v_class_assessment_progress"
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
            referencedRelation: "v_class_assessment_progress"
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
            referencedRelation: "v_class_assessment_progress"
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
            referencedRelation: "v_at_risk_assessment_students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "tuition_invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_assessment_progress"
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
      archive_flashcard_page: {
        Args: { p_page_id: string }
        Returns: undefined
      }
      attach_answer_media: {
        Args: {
          p_attempt_id: string
          p_duration_ms?: number
          p_kind: Database["public"]["Enums"]["question_set_kind"]
          p_mime: string
          p_object_path: string
          p_set_item_id: string
          p_size: number
        }
        Returns: undefined
      }
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
      clear_answer_media: {
        Args: {
          p_attempt_id: string
          p_kind: Database["public"]["Enums"]["question_set_kind"]
          p_set_item_id: string
        }
        Returns: undefined
      }
      clone_question: { Args: { p_question_id: string }; Returns: string }
      consume_rate_limit: { Args: { p_scope: string }; Returns: boolean }
      create_exam_delivery: {
        Args: {
          p_class_id: string
          p_closes_at: string
          p_duration_minutes: number
          p_exam_type: Database["public"]["Enums"]["assessment_type"]
          p_opens_at: string
          p_passing_score?: number
          p_set_version_id: string
          p_title: string
        }
        Returns: string
      }
      create_exercise_delivery: {
        Args: {
          p_allow_late?: boolean
          p_answer_release?: Database["public"]["Enums"]["answer_release_mode"]
          p_attempt_limit?: number
          p_available_from: string
          p_class_id: string
          p_due_at: string
          p_late_penalty?: number
          p_max_score: number
          p_result_release?: Database["public"]["Enums"]["result_release_mode"]
          p_set_version_id: string
          p_title: string
        }
        Returns: string
      }
      create_multi_class_exam_deliveries: {
        Args: {
          p_answer_release_mode?: Database["public"]["Enums"]["answer_release_mode"]
          p_class_ids: string[]
          p_closes_at: string
          p_duration_minutes: number
          p_exam_type: Database["public"]["Enums"]["assessment_type"]
          p_opens_at: string
          p_passing_score?: number
          p_publish?: boolean
          p_set_version_id: string
          p_title: string
        }
        Returns: string[]
      }
      create_multi_class_exercise_deliveries: {
        Args: {
          p_allow_late: boolean
          p_attempt_limit: number
          p_available_from: string
          p_class_ids: string[]
          p_due_at: string
          p_late_penalty: number
          p_max_score: number
          p_publish?: boolean
          p_set_version_id: string
          p_title: string
        }
        Returns: string[]
      }
      create_question_set_version: {
        Args: {
          p_instructions?: string
          p_question_set_id: string
          p_title: string
        }
        Returns: string
      }
      create_question_version: {
        Args: {
          p_answer_key?: Json
          p_explanation_text?: string
          p_grading_config?: Json
          p_normalization_config?: Json
          p_options?: Json
          p_prompt_content?: Json
          p_prompt_text: string
          p_question_id: string
          p_question_type: Database["public"]["Enums"]["question_type"]
        }
        Returns: string
      }
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
      finalize_assessment_attempts: { Args: never; Returns: Json }
      finalize_expired_exam_attempts: { Args: never; Returns: number }
      generate_class_sessions: { Args: { p_class_id: string }; Returns: number }
      get_exam_attempt_payload: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      get_exercise_attempt_payload: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      get_my_assessment_result: {
        Args: {
          p_attempt_id: string
          p_kind: Database["public"]["Enums"]["question_set_kind"]
        }
        Returns: Json
      }
      get_my_wrong_answer_reviews: { Args: never; Returns: Json }
      get_student_assessment_overview: { Args: never; Returns: Json }
      grade_exam_answer: {
        Args: {
          p_answer_id: string
          p_feedback?: string
          p_override_reason?: string
          p_score: number
        }
        Returns: undefined
      }
      grade_exam_answers_bulk: {
        Args: { p_delivery_id: string; p_grades: Json }
        Returns: number
      }
      grade_exercise_answer: {
        Args: {
          p_answer_id: string
          p_feedback?: string
          p_override_reason?: string
          p_score: number
        }
        Returns: undefined
      }
      grade_exercise_answers_bulk: {
        Args: { p_delivery_id: string; p_grades: Json }
        Returns: number
      }
      import_questions: { Args: { p_rows: Json }; Returns: Json }
      invalidate_exam_attempt: {
        Args: { p_attempt_id: string; p_reason: string }
        Returns: undefined
      }
      issue_tuition_invoice: { Args: { p_invoice_id: string }; Returns: Json }
      lock_exam_results: { Args: { p_delivery_id: string }; Returns: undefined }
      lock_question_set_version: {
        Args: { p_set_version_id: string }
        Returns: undefined
      }
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
      log_exam_integrity_event: {
        Args: { p_attempt_id: string; p_context?: Json; p_event_type: string }
        Returns: string
      }
      move_question_set_item: {
        Args: { p_direction: number; p_item_id: string }
        Returns: undefined
      }
      publish_announcement: {
        Args: { p_announcement_id: string }
        Returns: number
      }
      publish_evaluation: { Args: { p_evaluation_id: string }; Returns: Json }
      publish_exam_delivery: {
        Args: { p_delivery_id: string }
        Returns: undefined
      }
      publish_exam_results: { Args: { p_delivery_id: string }; Returns: number }
      publish_exercise_delivery: {
        Args: { p_delivery_id: string }
        Returns: undefined
      }
      publish_exercise_results: {
        Args: { p_delivery_id: string }
        Returns: number
      }
      publish_flashcard_section: {
        Args: { p_section_id: string }
        Returns: undefined
      }
      publish_question_version: {
        Args: { p_question_id: string }
        Returns: undefined
      }
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
      remove_question_set_item: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      reorder_flashcard_pages: {
        Args: { p_page_ids: string[]; p_section_id: string }
        Returns: undefined
      }
      review_global_question: {
        Args: { p_approve: boolean; p_reason?: string; p_request_id: string }
        Returns: undefined
      }
      run_exam_regrade: {
        Args: { p_delivery_id: string; p_reason: string; p_rule_override: Json }
        Returns: string
      }
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
      save_exam_answer: {
        Args: {
          p_answer_payload: Json
          p_attempt_id: string
          p_set_item_id: string
        }
        Returns: string
      }
      save_exercise_answer: {
        Args: {
          p_answer_payload: Json
          p_attempt_id: string
          p_set_item_id: string
        }
        Returns: string
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
      share_question: {
        Args: {
          p_permission?: Database["public"]["Enums"]["question_share_permission"]
          p_question_id: string
          p_teacher_id: string
        }
        Returns: undefined
      }
      start_exam_attempt: {
        Args: { p_exam_delivery_id: string }
        Returns: {
          attempt_id: string
          deadline_at: string
          server_time: string
        }[]
      }
      start_exercise_attempt: {
        Args: { p_delivery_id: string }
        Returns: string
      }
      submit_exam_attempt: {
        Args: {
          p_attempt_id: string
          p_reason?: Database["public"]["Enums"]["submission_reason"]
        }
        Returns: Database["public"]["Enums"]["attempt_status"]
      }
      submit_exercise_attempt: {
        Args: { p_attempt_id: string }
        Returns: Database["public"]["Enums"]["attempt_status"]
      }
      submit_question_for_global_review: {
        Args: { p_question_id: string }
        Returns: string
      }
      submit_wrong_answer_review: {
        Args: { p_answer_payload: Json; p_queue_id: string }
        Returns: Json
      }
      transfer_enrollment: {
        Args: {
          p_enrollment_id: string
          p_reason?: string
          p_to_class_id: string
        }
        Returns: string
      }
      unlock_question_set_for_edit: {
        Args: { p_question_set_id: string }
        Returns: undefined
      }
    }
    Enums: {
      answer_release_mode:
        | "after_submit"
        | "after_due"
        | "with_results"
        | "never"
      assessment_type:
        | "quiz"
        | "midterm"
        | "final"
        | "mock_hsk"
        | "speaking"
        | "custom"
      attempt_status:
        | "in_progress"
        | "submitted"
        | "pending_manual_grading"
        | "graded"
        | "returned_for_revision"
        | "invalidated"
      attendance_status: "present" | "late" | "absent" | "excused"
      class_status: "planned" | "active" | "paused" | "completed" | "cancelled"
      course_program: "core" | "business"
      course_status: "draft" | "active" | "archived"
      course_type: "hsk" | "communication" | "kids" | "exam_prep" | "custom"
      delivery_mode: "offline" | "online" | "hybrid" | "in_house"
      enrollment_status:
        | "pending"
        | "active"
        | "paused"
        | "completed"
        | "withdrawn"
        | "transferred"
      evaluation_rating: "weak" | "average" | "good" | "excellent"
      exam_delivery_status:
        | "draft"
        | "scheduled"
        | "open"
        | "closed"
        | "grading"
        | "results_published"
        | "cancelled"
        | "archived"
      exercise_delivery_status:
        | "draft"
        | "scheduled"
        | "open"
        | "closed"
        | "grading"
        | "results_published"
        | "cancelled"
        | "archived"
      exercise_grading_method: "first" | "latest" | "highest"
      flashcard_page_kind: "session_cover" | "vocabulary"
      flashcard_status: "draft" | "published" | "archived"
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
        | "exercise_assigned"
        | "exercise_returned"
        | "exercise_result_published"
        | "exam_scheduled"
        | "exam_opening"
        | "exam_result_published"
      payment_method: "cash" | "bank_transfer" | "card" | "e_wallet" | "other"
      question_difficulty: "easy" | "medium" | "hard"
      question_set_kind: "exercise" | "exam"
      question_set_status: "draft" | "ready" | "archived"
      question_share_permission: "read" | "clone"
      question_skill:
        | "listening"
        | "speaking"
        | "reading"
        | "writing"
        | "vocabulary"
        | "grammar"
      question_status: "draft" | "ready" | "archived"
      question_type:
        | "single_choice"
        | "multiple_choice"
        | "true_false"
        | "fill_blank"
        | "short_text"
        | "ordering"
        | "matching"
        | "reading_group"
        | "listening_choice"
        | "dictation"
        | "essay_translation"
        | "speaking"
      question_visibility:
        | "private"
        | "shared"
        | "pending_global_review"
        | "global"
        | "rejected"
        | "archived"
      result_release_mode: "after_graded" | "after_due" | "manual"
      session_status: "scheduled" | "completed" | "cancelled" | "rescheduled"
      submission_reason:
        | "manual"
        | "duration_expired"
        | "exam_window_closed"
        | "system_finalize"
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
      answer_release_mode: [
        "after_submit",
        "after_due",
        "with_results",
        "never",
      ],
      assessment_type: [
        "quiz",
        "midterm",
        "final",
        "mock_hsk",
        "speaking",
        "custom",
      ],
      attempt_status: [
        "in_progress",
        "submitted",
        "pending_manual_grading",
        "graded",
        "returned_for_revision",
        "invalidated",
      ],
      attendance_status: ["present", "late", "absent", "excused"],
      class_status: ["planned", "active", "paused", "completed", "cancelled"],
      course_program: ["core", "business"],
      course_status: ["draft", "active", "archived"],
      course_type: ["hsk", "communication", "kids", "exam_prep", "custom"],
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
      exam_delivery_status: [
        "draft",
        "scheduled",
        "open",
        "closed",
        "grading",
        "results_published",
        "cancelled",
        "archived",
      ],
      exercise_delivery_status: [
        "draft",
        "scheduled",
        "open",
        "closed",
        "grading",
        "results_published",
        "cancelled",
        "archived",
      ],
      exercise_grading_method: ["first", "latest", "highest"],
      flashcard_page_kind: ["session_cover", "vocabulary"],
      flashcard_status: ["draft", "published", "archived"],
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
        "exercise_assigned",
        "exercise_returned",
        "exercise_result_published",
        "exam_scheduled",
        "exam_opening",
        "exam_result_published",
      ],
      payment_method: ["cash", "bank_transfer", "card", "e_wallet", "other"],
      question_difficulty: ["easy", "medium", "hard"],
      question_set_kind: ["exercise", "exam"],
      question_set_status: ["draft", "ready", "archived"],
      question_share_permission: ["read", "clone"],
      question_skill: [
        "listening",
        "speaking",
        "reading",
        "writing",
        "vocabulary",
        "grammar",
      ],
      question_status: ["draft", "ready", "archived"],
      question_type: [
        "single_choice",
        "multiple_choice",
        "true_false",
        "fill_blank",
        "short_text",
        "ordering",
        "matching",
        "reading_group",
        "listening_choice",
        "dictation",
        "essay_translation",
        "speaking",
      ],
      question_visibility: [
        "private",
        "shared",
        "pending_global_review",
        "global",
        "rejected",
        "archived",
      ],
      result_release_mode: ["after_graded", "after_due", "manual"],
      session_status: ["scheduled", "completed", "cancelled", "rescheduled"],
      submission_reason: [
        "manual",
        "duration_expired",
        "exam_window_closed",
        "system_finalize",
      ],
      user_role: ["super_admin", "teacher", "student"],
    },
  },
} as const
