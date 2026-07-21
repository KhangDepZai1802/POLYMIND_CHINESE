begin;

create extension if not exists pgtap with schema extensions;

select plan(40);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('wrong_answer_queue', 'wrong_answer_review_attempts')
      and c.relrowsecurity
  ),
  2,
  'mọi bảng Ôn câu sai đều bật RLS'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'wrong_answer_queue'
      and indexdef like '%student_id, question_version_id%'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ),
  'DB cưỡng chế một queue cho mỗi student + question version'
);
select ok(
  not has_table_privilege('anon', 'public.wrong_answer_queue', 'SELECT'),
  'anonymous không có table privilege queue'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_my_wrong_answer_reviews()',
    'EXECUTE'
  ),
  'authenticated có entrypoint đọc được kiểm role trong RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.submit_wrong_answer_review(uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated có entrypoint chấm lại được kiểm role trong RPC'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '67000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin.wrong-review-test@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '67000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'student-a.wrong-review-test@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '67000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'student-b.wrong-review-test@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '67000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'teacher.wrong-review-test@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('67000000-0000-4000-8000-000000000001', 'super_admin', 'Admin Wrong Review Test', 'admin.wrong-review-test@polymind.test'),
  ('67000000-0000-4000-8000-000000000002', 'student', 'Student A Wrong Review Test', 'student-a.wrong-review-test@polymind.test'),
  ('67000000-0000-4000-8000-000000000003', 'student', 'Student B Wrong Review Test', 'student-b.wrong-review-test@polymind.test'),
  ('67000000-0000-4000-8000-000000000004', 'teacher', 'Teacher Wrong Review Test', 'teacher.wrong-review-test@polymind.test');

insert into public.students (id, user_id, student_code, full_name)
values
  ('67100000-0000-4000-8000-000000000002', '67000000-0000-4000-8000-000000000002', 'HV-WRONG-A', 'Student A Wrong Review Test'),
  ('67100000-0000-4000-8000-000000000003', '67000000-0000-4000-8000-000000000003', 'HV-WRONG-B', 'Student B Wrong Review Test');

insert into public.courses (
  id, code, title, program, course_type, default_session_count, status
)
values (
  '67200000-0000-4000-8000-000000000001',
  'KH-WRONG', 'Khóa ôn câu sai', 'core', 'custom', 2, 'active'
);

insert into public.classes (
  id, course_id, code, name, capacity, delivery_mode, status
)
values (
  '67300000-0000-4000-8000-000000000001',
  '67200000-0000-4000-8000-000000000001',
  'LOP-WRONG', 'Lớp ôn câu sai', 20, 'offline', 'planned'
);

insert into public.enrollments (id, student_id, class_id, status)
values
  ('67400000-0000-4000-8000-000000000001', '67100000-0000-4000-8000-000000000002', '67300000-0000-4000-8000-000000000001', 'active'),
  ('67400000-0000-4000-8000-000000000002', '67100000-0000-4000-8000-000000000003', '67300000-0000-4000-8000-000000000001', 'active');

insert into public.questions (
  id, code, owner_id, title, course_id, skill, difficulty,
  visibility, status, created_by
)
values
  (
    '67500000-0000-4000-8000-000000000001', 'CH-WRONG-SINGLE',
    '67000000-0000-4000-8000-000000000001', 'Câu chọn sai',
    '67200000-0000-4000-8000-000000000001', 'vocabulary', 'easy',
    'private', 'ready', '67000000-0000-4000-8000-000000000001'
  ),
  (
    '67500000-0000-4000-8000-000000000002', 'CH-WRONG-LISTEN',
    '67000000-0000-4000-8000-000000000001', 'Câu nghe sai',
    '67200000-0000-4000-8000-000000000001', 'listening', 'medium',
    'private', 'ready', '67000000-0000-4000-8000-000000000001'
  ),
  (
    '67500000-0000-4000-8000-000000000003', 'CH-WRONG-ESSAY',
    '67000000-0000-4000-8000-000000000001', 'Câu tự luận',
    '67200000-0000-4000-8000-000000000001', 'writing', 'medium',
    'private', 'ready', '67000000-0000-4000-8000-000000000001'
  );

insert into public.question_versions (
  id, question_id, version_no, question_type, prompt_text,
  prompt_content, created_by
)
values
  (
    '67600000-0000-4000-8000-000000000001',
    '67500000-0000-4000-8000-000000000001', 1, 'single_choice',
    '你好 nghĩa là gì?',
    '{"answer_key":"không được lộ","hint":"Chọn một đáp án"}'::jsonb,
    '67000000-0000-4000-8000-000000000001'
  ),
  (
    '67600000-0000-4000-8000-000000000002',
    '67500000-0000-4000-8000-000000000002', 1, 'listening_choice',
    'Bạn nghe thấy từ nào?',
    '{"audio_path":"không được lộ"}'::jsonb,
    '67000000-0000-4000-8000-000000000001'
  ),
  (
    '67600000-0000-4000-8000-000000000003',
    '67500000-0000-4000-8000-000000000003', 1, 'essay_translation',
    'Dịch đoạn văn sau.', '{}',
    '67000000-0000-4000-8000-000000000001'
  );

insert into public.question_options (
  question_version_id, option_key, content, order_index
)
values
  ('67600000-0000-4000-8000-000000000001', 'a', 'Xin chào', 0),
  ('67600000-0000-4000-8000-000000000001', 'b', 'Cảm ơn', 1),
  ('67600000-0000-4000-8000-000000000002', 'a', '谢谢', 0),
  ('67600000-0000-4000-8000-000000000002', 'b', '再见', 1);

insert into public.question_answer_keys (
  question_version_id, answer_key, created_by
)
values
  ('67600000-0000-4000-8000-000000000001', '{"value":"a"}', '67000000-0000-4000-8000-000000000001'),
  ('67600000-0000-4000-8000-000000000002', '{"value":"b"}', '67000000-0000-4000-8000-000000000001'),
  ('67600000-0000-4000-8000-000000000003', '{}', '67000000-0000-4000-8000-000000000001');

insert into public.question_media (
  question_version_id, media_role, object_path, mime_type, size_bytes, uploaded_by
)
values
  (
    '67600000-0000-4000-8000-000000000001', 'prompt_audio',
    '67000000-0000-4000-8000-000000000001/wrong-single.mp3',
    'audio/mpeg', 1024, '67000000-0000-4000-8000-000000000001'
  ),
  (
    '67600000-0000-4000-8000-000000000002', 'prompt_audio',
    '67000000-0000-4000-8000-000000000001/wrong-listen.mp3',
    'audio/mpeg', 1024, '67000000-0000-4000-8000-000000000001'
  );

insert into public.question_sets (id, owner_id, kind, title, course_id, status)
values
  (
    '67700000-0000-4000-8000-000000000001',
    '67000000-0000-4000-8000-000000000001', 'exercise',
    'Bộ bài tập ôn sai', '67200000-0000-4000-8000-000000000001', 'ready'
  ),
  (
    '67700000-0000-4000-8000-000000000002',
    '67000000-0000-4000-8000-000000000001', 'exam',
    'Bộ bài thi ôn sai', '67200000-0000-4000-8000-000000000001', 'ready'
  );

insert into public.question_set_versions (
  id, question_set_id, version_no, title_snapshot, raw_max_score, created_by
)
values
  (
    '67800000-0000-4000-8000-000000000001',
    '67700000-0000-4000-8000-000000000001', 1,
    'Bài tập ôn sai v1', 2, '67000000-0000-4000-8000-000000000001'
  ),
  (
    '67800000-0000-4000-8000-000000000002',
    '67700000-0000-4000-8000-000000000002', 1,
    'Bài thi ôn sai v1', 1, '67000000-0000-4000-8000-000000000001'
  );

insert into public.question_set_items (
  id, set_version_id, question_version_id, order_index, points
)
values
  (
    '67900000-0000-4000-8000-000000000001',
    '67800000-0000-4000-8000-000000000001',
    '67600000-0000-4000-8000-000000000001', 0, 1
  ),
  (
    '67900000-0000-4000-8000-000000000003',
    '67800000-0000-4000-8000-000000000001',
    '67600000-0000-4000-8000-000000000003', 1, 1
  ),
  (
    '67900000-0000-4000-8000-000000000002',
    '67800000-0000-4000-8000-000000000002',
    '67600000-0000-4000-8000-000000000002', 0, 1
  );

insert into public.exercise_deliveries (
  id, class_id, set_version_id, title, available_from, due_at,
  attempt_limit, max_score, created_by
)
values (
  '67a00000-0000-4000-8000-000000000001',
  '67300000-0000-4000-8000-000000000001',
  '67800000-0000-4000-8000-000000000001',
  'Bài tập phát hiện câu sai', now() - interval '2 days', now() + interval '2 days',
  5, 10, '67000000-0000-4000-8000-000000000001'
);

insert into public.exercise_attempts (
  id, delivery_id, enrollment_id, attempt_no, status, submitted_at
)
values
  (
    '67b00000-0000-4000-8000-000000000001',
    '67a00000-0000-4000-8000-000000000001',
    '67400000-0000-4000-8000-000000000001', 1, 'graded', now()
  ),
  (
    '67b00000-0000-4000-8000-000000000002',
    '67a00000-0000-4000-8000-000000000001',
    '67400000-0000-4000-8000-000000000001', 2, 'graded', now()
  );

insert into public.exercise_answers (
  id, attempt_id, set_item_id, answer_payload, auto_score, final_score, is_correct
)
values (
  '67c00000-0000-4000-8000-000000000001',
  '67b00000-0000-4000-8000-000000000001',
  '67900000-0000-4000-8000-000000000001', '{"value":"b"}', 0, 0, false
);

select is(
  (
    select wrong_count
    from public.wrong_answer_queue
    where student_id = '67100000-0000-4000-8000-000000000002'
      and question_version_id = '67600000-0000-4000-8000-000000000001'
  ),
  1,
  'answer objective sai tự động tạo queue'
);

update public.exercise_answers
set is_correct = false
where id = '67c00000-0000-4000-8000-000000000001';

select is(
  (
    select wrong_count
    from public.wrong_answer_queue
    where student_id = '67100000-0000-4000-8000-000000000002'
      and question_version_id = '67600000-0000-4000-8000-000000000001'
  ),
  1,
  'update false sang false không tăng đếm trùng'
);

insert into public.exercise_answers (
  id, attempt_id, set_item_id, answer_payload, auto_score, final_score, is_correct
)
values
  (
    '67c00000-0000-4000-8000-000000000002',
    '67b00000-0000-4000-8000-000000000002',
    '67900000-0000-4000-8000-000000000001', '{"value":"b"}', 0, 0, false
  ),
  (
    '67c00000-0000-4000-8000-000000000003',
    '67b00000-0000-4000-8000-000000000001',
    '67900000-0000-4000-8000-000000000003', '{"value":"bản dịch"}', null, null, false
  );

select is(
  (
    select count(*)::integer
    from public.wrong_answer_queue
    where student_id = '67100000-0000-4000-8000-000000000002'
      and question_version_id = '67600000-0000-4000-8000-000000000001'
  ),
  1,
  'sai lại cùng version vẫn chỉ có một queue row'
);
select is(
  (
    select wrong_count
    from public.wrong_answer_queue
    where student_id = '67100000-0000-4000-8000-000000000002'
      and question_version_id = '67600000-0000-4000-8000-000000000001'
  ),
  2,
  'sai lại tăng wrong_count'
);
select is(
  (
    select count(*)::integer
    from public.wrong_answer_queue
    where question_version_id = '67600000-0000-4000-8000-000000000003'
  ),
  0,
  'essay chấm tay không vào hàng đợi'
);

insert into public.exam_deliveries (
  id, class_id, set_version_id, title, exam_type, opens_at, closes_at,
  duration_minutes, status, created_by
)
values (
  '67d00000-0000-4000-8000-000000000001',
  '67300000-0000-4000-8000-000000000001',
  '67800000-0000-4000-8000-000000000002',
  'Bài thi phát hiện câu sai', 'custom',
  '2026-07-21 01:00:00+00', '2026-07-21 02:00:00+00', 60, 'closed',
  '67000000-0000-4000-8000-000000000001'
);

insert into public.exam_attempts (
  id, exam_delivery_id, enrollment_id, status, deadline_at, submitted_at
)
values (
  '67e00000-0000-4000-8000-000000000001',
  '67d00000-0000-4000-8000-000000000001',
  '67400000-0000-4000-8000-000000000001', 'graded',
  '2026-07-21 02:00:00+00', '2026-07-21 01:30:00+00'
);

insert into public.exam_answers (
  id, attempt_id, set_item_id, answer_payload, auto_score, final_score, is_correct
)
values (
  '67f00000-0000-4000-8000-000000000001',
  '67e00000-0000-4000-8000-000000000001',
  '67900000-0000-4000-8000-000000000002', '{"value":"a"}', 0, 0, false
);

select is(
  (
    select source_kind::text
    from public.wrong_answer_queue
    where question_version_id = '67600000-0000-4000-8000-000000000002'
  ),
  'exam',
  'câu Nghe máy chấm sai từ bài Thi vào queue với đúng source'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"67000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is((select count(*)::integer from public.wrong_answer_queue), 2, 'Student A đọc hai queue own');
select is((select count(*)::integer from public.wrong_answer_review_attempts), 0, 'Student A chưa có lịch sử ôn');
select is(jsonb_array_length(public.get_my_wrong_answer_reviews()), 2, 'RPC trả hai câu unresolved own');
select ok(
  public.get_my_wrong_answer_reviews()::text !~ 'answer_key|correct_answer|accepted_answers|audio_path|object_path',
  'payload RPC không lộ answer key hoặc object path'
);
select ok(
  public.get_my_wrong_answer_reviews() @> '[{"question_type":"listening_choice"}]'::jsonb,
  'RPC vẫn trả câu Nghe objective'
);
select is((select count(*)::integer from public.question_media), 2, 'student đọc media của queue unresolved own');
select ok(
  app.can_student_read_wrong_answer_media(
    '67000000-0000-4000-8000-000000000001/wrong-single.mp3'
  ),
  'student được ký media câu đang cần ôn'
);
select throws_ok(
  $$update public.wrong_answer_queue set resolved_at = now()$$,
  '42501',
  null,
  'student không tự sửa trạng thái mastery'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"67000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select is((select count(*)::integer from public.wrong_answer_queue), 0, 'Student B không đọc queue Student A');
select is((select count(*)::integer from public.wrong_answer_review_attempts), 0, 'Student B không đọc history Student A');
select is(jsonb_array_length(public.get_my_wrong_answer_reviews()), 0, 'RPC của Student B chỉ trả own empty');
select throws_ok(
  $$select public.submit_wrong_answer_review(
      (select id from public.wrong_answer_queue limit 1),
      '{"value":"a"}'::jsonb
    )$$,
  'P0001',
  'Không tìm thấy câu cần ôn',
  'Student B không submit queue Student A kể cả đoán UUID'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"67000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select is((select count(*)::integer from public.wrong_answer_queue), 0, 'teacher không đọc queue ôn câu sai');
select throws_ok(
  $$select public.get_my_wrong_answer_reviews()$$,
  'P0001',
  'Chỉ học viên đang hoạt động được xem câu sai',
  'RPC đọc fail-closed với teacher'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"67000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    public.submit_wrong_answer_review(
      (
        select id
        from public.wrong_answer_queue
        where question_version_id = '67600000-0000-4000-8000-000000000001'
      ),
      '{"value":"b"}'::jsonb
    )->>'is_correct'
  )::boolean,
  false,
  'RPC tự chấm câu trả lời ôn sai'
);
select is((select count(*)::integer from public.wrong_answer_review_attempts), 1, 'lần ôn sai được append history');
select is(
  (
    select resolved_at is null
    from public.wrong_answer_queue
    where question_version_id = '67600000-0000-4000-8000-000000000001'
  ),
  true,
  'ôn sai thì queue vẫn mở'
);
select is(
  (
    public.submit_wrong_answer_review(
      (
        select id
        from public.wrong_answer_queue
        where question_version_id = '67600000-0000-4000-8000-000000000001'
      ),
      '{"value":"a"}'::jsonb
    )->>'is_correct'
  )::boolean,
  true,
  'RPC tự chấm câu trả lời ôn đúng'
);
select is((select count(*)::integer from public.wrong_answer_review_attempts), 2, 'lần ôn đúng tiếp tục append history');
select is(jsonb_array_length(public.get_my_wrong_answer_reviews()), 1, 'câu đúng rời danh sách unresolved');
select ok(
  not app.can_student_read_wrong_answer_media(
    '67000000-0000-4000-8000-000000000001/wrong-single.mp3'
  ),
  'media câu đã resolved không còn được ký qua scope review'
);
select throws_ok(
  $$select public.submit_wrong_answer_review(
      (
        select id
        from public.wrong_answer_queue
        where question_version_id = '67600000-0000-4000-8000-000000000001'
      ),
      '{"value":"a"}'::jsonb
    )$$,
  'P0001',
  'Không tìm thấy câu cần ôn',
  'không submit lại queue đã resolved'
);
select throws_ok(
  $$insert into public.wrong_answer_review_attempts(
      queue_id, answer_payload, score, is_correct
    ) values (
      (select id from public.wrong_answer_queue limit 1), '{}', 1, true
    )$$,
  '42501',
  null,
  'student không tự ghi lịch sử hoặc tự khai đúng-sai'
);

reset role;

insert into public.exercise_attempts (
  id, delivery_id, enrollment_id, attempt_no, status, submitted_at
)
values (
  '67b00000-0000-4000-8000-000000000003',
  '67a00000-0000-4000-8000-000000000001',
  '67400000-0000-4000-8000-000000000001', 3, 'graded', now()
);
insert into public.exercise_answers (
  id, attempt_id, set_item_id, answer_payload, auto_score, final_score, is_correct
)
values (
  '67c00000-0000-4000-8000-000000000004',
  '67b00000-0000-4000-8000-000000000003',
  '67900000-0000-4000-8000-000000000001', '{"value":"b"}', 0, 0, false
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"67000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    select resolved_at is null
    from public.wrong_answer_queue
    where question_version_id = '67600000-0000-4000-8000-000000000001'
  ),
  true,
  'sai lại sau mastery tự mở lại queue'
);
select is(
  (
    select wrong_count
    from public.wrong_answer_queue
    where question_version_id = '67600000-0000-4000-8000-000000000001'
  ),
  3,
  'reopen vẫn giữ đúng tổng số lần sai'
);
select is(jsonb_array_length(public.get_my_wrong_answer_reviews()), 2, 'RPC lại trả câu vừa sai lại');

select set_config(
  'request.jwt.claims',
  '{"sub":"67000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select is((select count(*)::integer from public.wrong_answer_queue), 2, 'Super Admin đọc queue để hỗ trợ');

reset role;
select throws_ok(
  $$delete from public.wrong_answer_queue
    where question_version_id = '67600000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Không xóa cứng lịch sử ôn câu sai',
  'DB chặn hard-delete queue lịch sử'
);
select throws_ok(
  $$delete from public.wrong_answer_review_attempts$$,
  'P0001',
  'Không xóa cứng lịch sử ôn câu sai',
  'DB chặn hard-delete review attempts'
);

select * from finish();
rollback;
