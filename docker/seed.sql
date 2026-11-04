-- Initialize book metadata only. New libraries contain no finished stories.
INSERT INTO books (id,title,author,era,source_url,excerpt,note) VALUES ('liaozhai','聊斋志异','蒲松龄','清','','','待录入选定篇目的原文与来源。') ON CONFLICT(id) DO NOTHING;
INSERT INTO books (id,title,author,era,source_url,excerpt,note) VALUES ('shishuo','世说新语','刘义庆 编','南朝宋','','','待录入选定篇目的原文与来源。') ON CONFLICT(id) DO NOTHING;
INSERT INTO books (id,title,author,era,source_url,excerpt,note) VALUES ('zhuangzi','庄子','庄周等','先秦','','','待录入选定篇目的原文与来源。') ON CONFLICT(id) DO NOTHING;
