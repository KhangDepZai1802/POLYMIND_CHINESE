-- =============================================================================
-- SEED — Ngân hàng câu hỏi chủ đề NGÂN HÀNG (Tiếng Trung ngân hàng)
--
-- 32 câu = 4 kỹ năng × các dạng câu × 2 câu/dạng:
--   • Đọc      (reading)    : single_choice, multiple_choice, true_false, short_text
--   • Viết      (writing)    : essay_translation, fill_blank, short_text
--   • Từ vựng  (vocabulary) : single_choice, multiple_choice, fill_blank, short_text
--   • Ngữ pháp (grammar)    : single_choice, multiple_choice, true_false, fill_blank, ordering
--
-- CHỦ SỞ HỮU: một giáo viên (ưu tiên "Quách Duy Khang", nếu không có thì giáo
--             viên tạo sớm nhất; cuối cùng mới rơi về super_admin). visibility=private.
--
-- IDEMPOTENT: khóa theo (owner_id, title) → chạy lại KHÔNG nhân đôi.
--
-- Chạy trực tiếp bằng psql/SQL editor với quyền postgres hoặc service_role
-- (bỏ qua RLS — giống hệt kết quả mà create_question_version + publish tạo ra).
--
-- ⚠️ UTF-8: nạp bằng byte thô (docker cp / file upload / SQL editor), KHÔNG pipe
--    qua PowerShell (ANSI làm hỏng tiếng Việt/chữ Hán).
-- =============================================================================

-- --- Helper tạm thời (tự huỷ cuối phiên) -------------------------------------
create or replace function pg_temp.seed_bank_question(
  p_owner          uuid,
  p_title          text,
  p_skill          public.question_skill,
  p_difficulty     public.question_difficulty,
  p_type           public.question_type,
  p_prompt         text,
  p_explanation    text,
  p_options        jsonb,   -- mảng {key,content}; [] nếu không có lựa chọn
  p_answer_key     jsonb,
  p_grading        jsonb,   -- {} nếu không cần cấu hình chấm
  p_prompt_content jsonb    -- {} nếu không có audio/ảnh
) returns void language plpgsql as $fn$
declare v_qid uuid; v_vid uuid;
begin
  -- Idempotent: đã có câu cùng chủ sở hữu + tiêu đề thì bỏ qua.
  if exists (
    select 1 from public.questions
    where owner_id = p_owner and title = p_title
  ) then
    return;
  end if;

  insert into public.questions(owner_id, created_by, title, skill, difficulty, visibility, status)
  values (p_owner, p_owner, p_title, p_skill, p_difficulty, 'private', 'draft')
  returning id into v_qid;

  insert into public.question_versions(
    question_id, version_no, question_type, prompt_text, prompt_content,
    explanation_text, created_by)
  values (
    v_qid, 1, p_type, p_prompt, coalesce(p_prompt_content, '{}'::jsonb),
    nullif(p_explanation, ''), p_owner)
  returning id into v_vid;

  insert into public.question_options(question_version_id, option_key, content, order_index)
  select v_vid, o->>'key', o->>'content', (ord - 1)::int
  from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) with ordinality x(o, ord)
  where nullif(trim(o->>'content'), '') is not null;

  insert into public.question_answer_keys(question_version_id, answer_key, grading_config, created_by)
  values (v_vid, p_answer_key, coalesce(p_grading, '{}'::jsonb), p_owner);

  -- Trỏ current_version + đưa về trạng thái ready (giống publish_question_version).
  update public.questions set current_version_id = v_vid, status = 'ready' where id = v_qid;
end $fn$;

-- --- Chèn 32 câu -------------------------------------------------------------
do $seed$
declare v_owner uuid;
begin
  select p.id into v_owner
  from public.profiles p
  where p.role = 'teacher'
  order by (p.full_name = 'Quách Duy Khang') desc, p.created_at asc
  limit 1;

  if v_owner is null then
    select p.id into v_owner
    from public.profiles p
    where p.role = 'super_admin'
    order by p.created_at asc
    limit 1;
  end if;

  if v_owner is null then
    raise exception 'Không tìm thấy tài khoản teacher/super_admin để gán chủ sở hữu câu hỏi';
  end if;

  -- ========================= ĐỌC (reading) ==================================

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Đọc · Hiểu câu "mở tài khoản"', 'reading', 'easy', 'single_choice',
    E'阅读下面的句子，选择正确的意思：\n\n「我想在银行开一个账户。」\n\n这句话是什么意思？',
    'Trong tiếng Trung "开账户" nghĩa là mở tài khoản.',
    '[{"key":"1","content":"Tôi muốn mở một tài khoản ở ngân hàng."},
      {"key":"2","content":"Tôi muốn rút tiền ở ngân hàng."},
      {"key":"3","content":"Tôi muốn vay tiền ở ngân hàng."},
      {"key":"4","content":"Tôi muốn đóng tài khoản ở ngân hàng."}]'::jsonb,
    '{"value":"1"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Đọc · Số tiền gửi vào tài khoản', 'reading', 'medium', 'single_choice',
    E'阅读短文，回答问题：\n\n「张先生今天去银行取了两千元，又把一千元存进了储蓄账户。」\n\n张先生存进账户多少钱？',
    '"存进" = gửi vào. Ông Trương gửi vào 1000 tệ.',
    '[{"key":"1","content":"一千元"},
      {"key":"2","content":"两千元"},
      {"key":"3","content":"三千元"},
      {"key":"4","content":"五千元"}]'::jsonb,
    '{"value":"1"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Đọc · Dịch vụ ngân hàng cung cấp', 'reading', 'medium', 'multiple_choice',
    E'阅读银行通知，选出银行【提供】的所有业务：\n\n「本行营业时间可办理存款、取款和转账业务，暂不办理外币兑换。」',
    '"暂不办理外币兑换" = tạm thời KHÔNG làm đổi ngoại tệ.',
    '[{"key":"1","content":"存款 (gửi tiền)"},
      {"key":"2","content":"取款 (rút tiền)"},
      {"key":"3","content":"转账 (chuyển khoản)"},
      {"key":"4","content":"外币兑换 (đổi ngoại tệ)"}]'::jsonb,
    '{"values":["1","2","3"]}'::jsonb,
    '{"scoring_mode":"all_or_nothing","wrong_selection_zero":false}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Đọc · Phí thẻ tín dụng', 'reading', 'medium', 'multiple_choice',
    E'阅读句子，选出所有正确的理解：\n\n「办理这张信用卡不收年费，但取现金要付手续费。」',
    'Không thu phí thường niên (不收年费); rút tiền mặt phải trả phí (取现金要付手续费).',
    '[{"key":"1","content":"Làm thẻ tín dụng này không mất phí thường niên."},
      {"key":"2","content":"Rút tiền mặt phải trả phí thủ tục."},
      {"key":"3","content":"Làm thẻ này phải trả phí thường niên."},
      {"key":"4","content":"Rút tiền mặt được miễn phí."}]'::jsonb,
    '{"values":["1","2"]}'::jsonb,
    '{"scoring_mode":"partial_credit","wrong_selection_zero":false}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Đọc · Số dư không đủ', 'reading', 'easy', 'true_false',
    E'阅读句子并判断：\n\n「小李的银行卡里只有五百元余额，他想取六百元。」\n\n判断：小李可以顺利取出六百元。',
    'Số dư (余额) 500 tệ < 600 tệ nên không rút được.',
    '[]'::jsonb, '{"value":"false"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Đọc · So sánh lãi suất', 'reading', 'easy', 'true_false',
    E'阅读句子并判断对错：\n\n「这家银行的定期存款利率比活期存款高。」\n\n判断：定期存款的利率更高。',
    '定期存款 (gửi có kỳ hạn) có lãi suất cao hơn 活期 (không kỳ hạn).',
    '[]'::jsonb, '{"value":"true"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Đọc · Nơi rút tiền', 'reading', 'easy', 'short_text',
    E'阅读句子，用中文回答问题：\n\n「王女士在自动取款机上取了钱。」\n\n她在哪里取钱？（用中文填写地点）',
    '自动取款机 = máy rút tiền tự động (ATM).',
    '[]'::jsonb,
    '{"accepted":["自动取款机","取款机","ATM","自动柜员机"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Đọc · Mục đích đến ngân hàng', 'reading', 'medium', 'short_text',
    E'阅读句子，用一个中文词语回答：\n\n「李经理去银行是为了申请一笔贷款。」\n\n李经理去银行做什么？',
    '申请贷款 = xin vay / làm thủ tục vay.',
    '[]'::jsonb,
    '{"accepted":["申请贷款","贷款","申请一笔贷款"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  -- ========================= VIẾT (writing) =================================

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Viết · Dịch câu mở tài khoản tiết kiệm', 'writing', 'medium', 'essay_translation',
    E'请把下面的越南语句子翻译成中文：\n\n「Tôi muốn mở một tài khoản tiết kiệm và gửi năm triệu đồng.」\n\n(Gợi ý từ vựng: 储蓄账户、开户、存款)',
    E'Tham khảo: 我想开一个储蓄账户，存五百万越南盾。',
    '[]'::jsonb, '{"manual":true}'::jsonb,
    '{"rubric":[{"criterion":"Dùng đúng từ vựng ngân hàng (开户/储蓄账户/存款)","points":2},
                {"criterion":"Ngữ pháp và trật tự từ đúng","points":2},
                {"criterion":"Chữ Hán viết đúng, đủ ý","points":1}]}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Viết · Mô tả các bước rút tiền ATM', 'writing', 'hard', 'essay_translation',
    E'请用中文写一小段话（3–4 句），说明在自动取款机（ATM）上取钱的步骤：\n插卡 → 输入密码 → 取款 → 取卡。',
    'Chú ý dùng đúng thứ tự và thuật ngữ: 插卡、输入密码、取款、取卡.',
    '[]'::jsonb, '{"manual":true}'::jsonb,
    '{"rubric":[{"criterion":"Nêu đủ 4 bước theo thứ tự","points":2},
                {"criterion":"Dùng đúng thuật ngữ ngân hàng","points":2},
                {"criterion":"Câu văn mạch lạc, đúng ngữ pháp","points":2}]}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Viết · Điền chữ Hán "mật khẩu"', 'writing', 'easy', 'fill_blank',
    E'请填入合适的汉字（chữ Hán）：\n\n请在这里输入您的银行卡＿＿。（mật khẩu）',
    '密码 = mật khẩu.',
    '[]'::jsonb, '{"accepted":["密码"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Viết · Điền chữ Hán "ký tên"', 'writing', 'medium', 'fill_blank',
    E'请填入合适的汉字：\n\n银行职员说：「请您在单子上签＿。」（ký tên）',
    '签名 / 签字 = ký tên.',
    '[]'::jsonb, '{"accepted":["名","字","名字"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Viết · Cách nói "rút tiền mặt"', 'writing', 'easy', 'short_text',
    E'请用中文写出「rút tiền mặt」这个动作的说法（用汉字）。',
    '取现金 / 取款 / 取钱.',
    '[]'::jsonb, '{"accepted":["取现金","取款","取钱"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Viết · Cách nói "chuyển khoản ngân hàng"', 'writing', 'medium', 'short_text',
    E'请用中文写出「chuyển khoản ngân hàng」的说法（用汉字）。',
    '转账 / 银行转账 / 汇款.',
    '[]'::jsonb, '{"accepted":["转账","银行转账","汇款"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  -- ========================= TỪ VỰNG (vocabulary) ===========================

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Từ vựng · Nghĩa của 利息', 'vocabulary', 'easy', 'single_choice',
    E'「利息」的意思是什么？',
    '利息 = tiền lãi.',
    '[{"key":"1","content":"Tiền lãi"},
      {"key":"2","content":"Mật khẩu"},
      {"key":"3","content":"Tiền mặt"},
      {"key":"4","content":"Phí thủ tục"}]'::jsonb,
    '{"value":"1"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Từ vựng · Từ chỉ "thẻ tín dụng"', 'vocabulary', 'easy', 'single_choice',
    E'下面哪个词的意思是「thẻ tín dụng」？',
    '信用卡 = thẻ tín dụng.',
    '[{"key":"1","content":"储蓄卡"},
      {"key":"2","content":"信用卡"},
      {"key":"3","content":"会员卡"},
      {"key":"4","content":"身份证"}]'::jsonb,
    '{"value":"2"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Từ vựng · Từ liên quan ngân hàng', 'vocabulary', 'easy', 'multiple_choice',
    E'以下哪些词与「银行」有关？（选出所有相关的词）',
    '菜单 = thực đơn, không liên quan ngân hàng.',
    '[{"key":"1","content":"存款"},
      {"key":"2","content":"菜单"},
      {"key":"3","content":"转账"},
      {"key":"4","content":"利率"}]'::jsonb,
    '{"values":["1","3","4"]}'::jsonb,
    '{"scoring_mode":"partial_credit","wrong_selection_zero":false}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Từ vựng · Nghiệp vụ tại ngân hàng', 'vocabulary', 'medium', 'multiple_choice',
    E'下面哪些是可以在银行办理的业务？',
    '点菜 = gọi món (ở nhà hàng), không phải nghiệp vụ ngân hàng.',
    '[{"key":"1","content":"开户 (mở tài khoản)"},
      {"key":"2","content":"挂失 (báo mất thẻ)"},
      {"key":"3","content":"点菜 (gọi món)"},
      {"key":"4","content":"换外币 (đổi ngoại tệ)"}]'::jsonb,
    '{"values":["1","2","4"]}'::jsonb,
    '{"scoring_mode":"all_or_nothing","wrong_selection_zero":false}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Từ vựng · Điền từ "quầy giao dịch"', 'vocabulary', 'easy', 'fill_blank',
    E'请填入合适的词语：\n\n我在银行排队等叫号，轮到我时就走到＿＿办理业务。（quầy giao dịch）',
    '柜台 = quầy giao dịch.',
    '[]'::jsonb, '{"accepted":["柜台"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Từ vựng · Điền từ "báo mất thẻ"', 'vocabulary', 'medium', 'fill_blank',
    E'请填空：\n\n银行卡丢了要马上打电话给银行＿＿。（báo mất）',
    '挂失 = báo mất (thẻ/sổ).',
    '[]'::jsonb, '{"accepted":["挂失"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Từ vựng · Nói "số dư tài khoản"', 'vocabulary', 'easy', 'short_text',
    E'「số dư tài khoản」用中文怎么说？（用汉字）',
    '余额 / 账户余额.',
    '[]'::jsonb, '{"accepted":["余额","账户余额"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Từ vựng · Nói "khoản vay"', 'vocabulary', 'medium', 'short_text',
    E'「khoản vay / vay tiền」用中文怎么说？（用汉字）',
    '贷款 / 借款.',
    '[]'::jsonb, '{"accepted":["贷款","借款"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  -- ========================= NGỮ PHÁP (grammar) =============================

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Ngữ pháp · Lượng từ cho thẻ', 'grammar', 'easy', 'single_choice',
    E'选择正确的量词：\n\n我要办一＿信用卡。',
    'Thẻ (卡) dùng lượng từ 张.',
    '[{"key":"1","content":"张"},
      {"key":"2","content":"个"},
      {"key":"3","content":"条"},
      {"key":"4","content":"本"}]'::jsonb,
    '{"value":"1"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Ngữ pháp · Giới từ 在', 'grammar', 'medium', 'single_choice',
    E'选择正确的介词填空：\n\n我想＿银行存钱。',
    '在银行存钱 = gửi tiền ở ngân hàng.',
    '[{"key":"1","content":"从"},
      {"key":"2","content":"到"},
      {"key":"3","content":"在"},
      {"key":"4","content":"向"}]'::jsonb,
    '{"value":"3"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Ngữ pháp · Câu đúng ngữ pháp', 'grammar', 'medium', 'multiple_choice',
    E'下面哪些句子语法正确？（选出所有正确的句子）',
    'Câu 2 và 4 sai trật tự chữ 把/被.',
    '[{"key":"1","content":"我把钱存到银行了。"},
      {"key":"2","content":"我存钱把银行了。"},
      {"key":"3","content":"请你把密码输入一下。"},
      {"key":"4","content":"银行被我存了钱。"}]'::jsonb,
    '{"values":["1","3"]}'::jsonb,
    '{"scoring_mode":"all_or_nothing","wrong_selection_zero":false}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Ngữ pháp · Điền từ chỉ khả năng', 'grammar', 'medium', 'multiple_choice',
    E'哪些词可以填入空格，使句子通顺？\n\n这张卡＿在国外取钱。',
    '可以/能取钱 (đều đúng); 会/刚 không hợp nghĩa ở đây.',
    '[{"key":"1","content":"可以"},
      {"key":"2","content":"能"},
      {"key":"3","content":"会"},
      {"key":"4","content":"刚"}]'::jsonb,
    '{"values":["1","2"]}'::jsonb,
    '{"scoring_mode":"partial_credit","wrong_selection_zero":false}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Ngữ pháp · Câu đúng (đúng/sai)', 'grammar', 'easy', 'true_false',
    E'判断语法对错：\n\n「我昨天在银行开了一个账户。」这个句子语法正确。',
    'Câu đúng ngữ pháp: chủ ngữ + thời gian + 在+地点 + động từ + 了 + tân ngữ.',
    '[]'::jsonb, '{"value":"true"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Ngữ pháp · Câu bị động sai', 'grammar', 'medium', 'true_false',
    E'判断对错：\n\n句子「你的钱被取了小偷」语法正确。',
    'Sai. Đúng phải là: 你的钱被小偷取了。(被 + chủ thể + động từ).',
    '[]'::jsonb, '{"value":"false"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Ngữ pháp · Trợ từ 了', 'grammar', 'medium', 'fill_blank',
    E'用「了」或「过」填空：\n\n我已经在这家银行存＿三年钱了。',
    '存了三年钱了 — dùng 了 chỉ hành động kéo dài đến hiện tại.',
    '[]'::jsonb, '{"accepted":["了"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Ngữ pháp · Trợ từ 地', 'grammar', 'medium', 'fill_blank',
    E'请填入正确的结构助词（的／得／地）：\n\n他很快＿办完了转账手续。',
    '很快地 + động từ — 地 đứng trước động từ làm trạng ngữ.',
    '[]'::jsonb, '{"accepted":["地"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Ngữ pháp · Sắp xếp câu (gửi tiền)', 'grammar', 'medium', 'ordering',
    E'请把下面的词语排成一个正确的句子：\n\n我 / 想 / 在 / 银行 / 存 / 一千 / 块 / 钱',
    'Câu đúng: 我想在银行存一千块钱。',
    '[{"key":"1","content":"我"},{"key":"2","content":"想"},{"key":"3","content":"在"},
      {"key":"4","content":"银行"},{"key":"5","content":"存"},{"key":"6","content":"一千"},
      {"key":"7","content":"块"},{"key":"8","content":"钱"}]'::jsonb,
    '{"value":["我","想","在","银行","存","一千","块","钱"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  perform pg_temp.seed_bank_question(v_owner,
    'NH · Ngữ pháp · Sắp xếp câu (nhập mật khẩu)', 'grammar', 'medium', 'ordering',
    E'请把下面的词语排成一个正确的句子：\n\n请 / 输入 / 您 / 的 / 银行卡 / 密码',
    'Câu đúng: 请输入您的银行卡密码。',
    '[{"key":"1","content":"请"},{"key":"2","content":"输入"},{"key":"3","content":"您"},
      {"key":"4","content":"的"},{"key":"5","content":"银行卡"},{"key":"6","content":"密码"}]'::jsonb,
    '{"value":["请","输入","您","的","银行卡","密码"]}'::jsonb, '{}'::jsonb, '{}'::jsonb);

  raise notice 'Seed ngân hàng câu hỏi (chủ đề ngân hàng) hoàn tất cho owner %', v_owner;
end $seed$;
