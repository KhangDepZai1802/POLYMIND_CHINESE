-- 54 — Kỹ năng Nói: thêm question type `speaking`.
--
-- Tách riêng một file vì `ALTER TYPE ... ADD VALUE` phải được commit TRƯỚC khi
-- giá trị enum mới được dùng ở migration/DML sau. Migration 55 mới dựa vào
-- 'speaking' (auto_score coi là chấm tay, seed…), nên nó phải nằm ở file kế tiếp.

alter type public.question_type add value if not exists 'speaking';
