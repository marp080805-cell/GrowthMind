-- Seed: 8 system presets
-- Migration: 003_seed_presets.sql

INSERT INTO presets (id, name, description, icon, tags, nodes, edges, is_system) VALUES

-- 1. Relatório Semanal WhatsApp
(
  gen_random_uuid(),
  'Relatório Semanal WhatsApp',
  'Envia relatório de performance semanal via WhatsApp para o cliente',
  '📊',
  '["meta", "ia", "whatsapp", "agendamento"]'::jsonb,
  '[
    {"id": "n1", "type": "trigger.schedule", "label": "Todo sábado às 9h", "config": {"frequency": "weekly", "time": "09:00", "days": ["sat"]}, "position": {"x": 250, "y": 50}},
    {"id": "n2", "type": "meta.fetch_metrics", "label": "Buscar métricas", "config": {"period": "7d", "metrics": ["impressoes","alcance","cliques","ctr","cpc","cpm","gasto"]}, "position": {"x": 250, "y": 200}},
    {"id": "n3", "type": "ai.agent", "label": "Gerar relatório", "config": {"model": "gpt-4o", "system_prompt": "Você é um analista de marketing digital para {{cliente.tipo_negocio}}. Contexto do cliente: {{cliente.contexto}}", "human_message": "Gere um relatório semanal conciso e amigável com os dados: Impressões: {{metricas.impressoes}}, Alcance: {{metricas.alcance}}, CTR: {{metricas.ctr}}%, CPC: R${{metricas.cpc}}, Gasto: R${{metricas.gasto}}", "temperature": 0.7, "max_tokens": 500, "output_format": "text"}, "position": {"x": 250, "y": 350}},
    {"id": "n4", "type": "whatsapp.send_message", "label": "Enviar WhatsApp", "config": {"number_type": "client", "type": "text", "message": "{{input}}"}, "position": {"x": 250, "y": 500}}
  ]'::jsonb,
  '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e3", "source": "n3", "target": "n4", "sourceHandle": "default", "targetHandle": "default"}
  ]'::jsonb,
  true
),

-- 2. Sincronizar Posts Instagram
(
  gen_random_uuid(),
  'Sincronizar Posts Instagram',
  'Detecta novos posts no Instagram e os sobe como anúncios automaticamente',
  '📸',
  '["meta", "instagram", "agendamento"]'::jsonb,
  '[
    {"id": "n1", "type": "trigger.schedule", "label": "Todo dia às 10h", "config": {"frequency": "daily", "time": "10:00"}, "position": {"x": 250, "y": 50}},
    {"id": "n2", "type": "trigger.instagram", "label": "Novo post Instagram", "config": {"check_frequency": "6h"}, "position": {"x": 250, "y": 200}},
    {"id": "n3", "type": "logic.if", "label": "Tem post novo?", "config": {"variable": "{{posts.total}}", "operator": ">", "value": "0"}, "position": {"x": 250, "y": 350}},
    {"id": "n4", "type": "meta.boost_post", "label": "Subir como anúncio", "config": {}, "position": {"x": 400, "y": 500}}
  ]'::jsonb,
  '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e3", "source": "n3", "target": "n4", "sourceHandle": "yes", "targetHandle": "default"}
  ]'::jsonb,
  true
),

-- 3. Alerta de Performance
(
  gen_random_uuid(),
  'Alerta de Performance',
  'Monitora métricas e envia alerta via WhatsApp quando CPC está alto',
  '🚨',
  '["meta", "whatsapp", "agendamento"]'::jsonb,
  '[
    {"id": "n1", "type": "trigger.schedule", "label": "Toda manhã às 8h", "config": {"frequency": "daily", "time": "08:00"}, "position": {"x": 250, "y": 50}},
    {"id": "n2", "type": "meta.fetch_metrics", "label": "Buscar métricas", "config": {"period": "7d", "metrics": ["cpc","ctr","cpm","gasto"]}, "position": {"x": 250, "y": 200}},
    {"id": "n3", "type": "logic.if", "label": "CPC alto?", "config": {"variable": "{{metricas.cpc}}", "operator": ">", "value": "2.0"}, "position": {"x": 250, "y": 350}},
    {"id": "n4", "type": "whatsapp.send_message", "label": "Alerta WhatsApp", "config": {"number_type": "client", "type": "text", "message": "⚠️ ALERTA: CPC de {{cliente.nome}} está em R${{metricas.cpc}} (acima de R$2,00). CTR: {{metricas.ctr}}%. Gasto: R${{metricas.gasto}}. Revisar campanhas!"}, "position": {"x": 400, "y": 500}}
  ]'::jsonb,
  '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e3", "source": "n3", "target": "n4", "sourceHandle": "yes", "targetHandle": "default"}
  ]'::jsonb,
  true
),

-- 4. Criativo do Drive
(
  gen_random_uuid(),
  'Criativo do Drive',
  'Detecta novo arquivo de criativo no Google Drive e cria anúncio automaticamente',
  '📁',
  '["drive", "meta"]'::jsonb,
  '[
    {"id": "n1", "type": "trigger.drive_file", "label": "Arquivo novo no Drive", "config": {"file_types": ["image"]}, "position": {"x": 250, "y": 50}},
    {"id": "n2", "type": "drive.download_file", "label": "Baixar criativo", "config": {}, "position": {"x": 250, "y": 200}},
    {"id": "n3", "type": "meta.create_ad", "label": "Criar anúncio", "config": {}, "position": {"x": 250, "y": 350}}
  ]'::jsonb,
  '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"}
  ]'::jsonb,
  true
),

-- 5. Criativo do Notion
(
  gen_random_uuid(),
  'Criativo do Notion',
  'Monitora database do Notion e cria anúncio quando nova entrada é adicionada',
  '📓',
  '["notion", "meta"]'::jsonb,
  '[
    {"id": "n1", "type": "trigger.notion_page", "label": "Página nova no Notion", "config": {}, "position": {"x": 250, "y": 50}},
    {"id": "n2", "type": "notion.read_database", "label": "Ler dados do Notion", "config": {}, "position": {"x": 250, "y": 200}},
    {"id": "n3", "type": "meta.create_ad", "label": "Criar anúncio", "config": {}, "position": {"x": 250, "y": 350}}
  ]'::jsonb,
  '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"}
  ]'::jsonb,
  true
),

-- 6. Relatório Mensal Completo
(
  gen_random_uuid(),
  'Relatório Mensal Completo',
  'No fim do mês, gera relatório completo com IA e salva no Notion + envia WhatsApp',
  '📋',
  '["meta", "ia", "notion", "whatsapp", "agendamento"]'::jsonb,
  '[
    {"id": "n1", "type": "trigger.schedule", "label": "Dia 1 às 9h", "config": {"frequency": "monthly", "time": "09:00", "day_of_month": 1}, "position": {"x": 250, "y": 50}},
    {"id": "n2", "type": "meta.fetch_metrics", "label": "Métricas do mês", "config": {"period": "last_month", "metrics": ["impressoes","alcance","cliques","ctr","cpc","cpm","gasto","roas"]}, "position": {"x": 250, "y": 200}},
    {"id": "n3", "type": "ai.agent", "label": "Análise com IA", "config": {"model": "gpt-4o", "system_prompt": "Você é analista de marketing para {{cliente.tipo_negocio}}. {{cliente.contexto}}", "human_message": "Faça análise detalhada do mês de {{mes_atual}}: Gasto: R${{metricas.gasto}}, ROAS: {{metricas.roas}}, CTR: {{metricas.ctr}}%, CPC: R${{metricas.cpc}}, Impressões: {{metricas.impressoes}}", "temperature": 0.6, "max_tokens": 1000, "output_format": "text"}, "position": {"x": 250, "y": 350}},
    {"id": "n4", "type": "notion.create_page", "label": "Salvar no Notion", "config": {}, "position": {"x": 100, "y": 500}},
    {"id": "n5", "type": "whatsapp.send_report", "label": "Enviar WhatsApp", "config": {"number_type": "client", "type": "text", "message": "📊 Relatório de {{mes_atual}} — {{cliente.nome}}\n\n{{input}}"}, "position": {"x": 400, "y": 500}}
  ]'::jsonb,
  '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e3", "source": "n3", "target": "n4", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e4", "source": "n3", "target": "n5", "sourceHandle": "default", "targetHandle": "default"}
  ]'::jsonb,
  true
),

-- 7. Pausar anúncios com baixo CTR
(
  gen_random_uuid(),
  'Pausar anúncios com baixo CTR',
  'Verifica diariamente e pausa anúncios com CTR abaixo do threshold configurado',
  '⏸️',
  '["meta", "agendamento"]'::jsonb,
  '[
    {"id": "n1", "type": "trigger.schedule", "label": "Todo dia às 7h", "config": {"frequency": "daily", "time": "07:00"}, "position": {"x": 250, "y": 50}},
    {"id": "n2", "type": "meta.fetch_creative_insights", "label": "Insights por criativo", "config": {"period": "7d"}, "position": {"x": 250, "y": 200}},
    {"id": "n3", "type": "logic.loop", "label": "Para cada criativo", "config": {"list": "{{input.criativos}}", "item_var": "criativo", "max_iterations": 50}, "position": {"x": 250, "y": 350}},
    {"id": "n4", "type": "logic.if", "label": "CTR baixo?", "config": {"variable": "{{criativo.ctr}}", "operator": "<", "value": "1.0"}, "position": {"x": 250, "y": 500}},
    {"id": "n5", "type": "meta.pause_ad", "label": "Pausar anúncio", "config": {"ad_id": "{{criativo.id}}"}, "position": {"x": 400, "y": 650}}
  ]'::jsonb,
  '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e3", "source": "n3", "target": "n4", "sourceHandle": "each", "targetHandle": "default"},
    {"id": "e4", "source": "n4", "target": "n5", "sourceHandle": "yes", "targetHandle": "default"}
  ]'::jsonb,
  true
),

-- 8. Gerar copy com IA
(
  gen_random_uuid(),
  'Gerar copy com IA',
  'Executa manualmente: IA gera variações de copy e cria anúncio no Meta',
  '✍️',
  '["ia", "meta"]'::jsonb,
  '[
    {"id": "n1", "type": "trigger.manual", "label": "Iniciar geração", "config": {}, "position": {"x": 250, "y": 50}},
    {"id": "n2", "type": "meta.fetch_metrics", "label": "Buscar contexto", "config": {"period": "7d", "metrics": ["ctr","cpc","gasto"]}, "position": {"x": 250, "y": 200}},
    {"id": "n3", "type": "ai.agent", "label": "Gerar copies", "config": {"model": "gpt-4o", "system_prompt": "Você é copywriter especializado em {{cliente.tipo_negocio}}. Contexto: {{cliente.contexto}}", "human_message": "Gere 3 variações de copy para anúncio Meta com base no CTR atual de {{metricas.ctr}}%. O copy deve ser persuasivo e diferente para teste A/B.", "temperature": 0.9, "max_tokens": 500, "output_format": "json", "output_schema": {"copies": [{"titulo": "string", "texto": "string", "cta": "string"}]}}, "position": {"x": 250, "y": 350}},
    {"id": "n4", "type": "meta.create_ad", "label": "Criar anúncio", "config": {"text": "{{input.copies.0.texto}}"}, "position": {"x": 250, "y": 500}}
  ]'::jsonb,
  '[
    {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "default", "targetHandle": "default"},
    {"id": "e3", "source": "n3", "target": "n4", "sourceHandle": "default", "targetHandle": "default"}
  ]'::jsonb,
  true
);

-- Seed demo data
INSERT INTO clients (name, business_type, whatsapp, context, status) VALUES
(
  'Açaí do Zé',
  'Delivery',
  '(11) 99999-0001',
  'O Açaí do Zé é uma empresa de delivery especializada em açaí e frutas tropicais. Tom de voz: descontraído, jovem e energético. Público-alvo: jovens de 18-35 anos, praticantes de exercícios, saudáveis. Diferenciais: açaí premium da Amazônia, entrega em 30 minutos, opções veganas. Produtos principais: açaí 500ml, açaí com granola, vitamina de banana, smoothies tropicais.',
  'active'
),
(
  'Clínica Bella Vida',
  'Saúde',
  '(11) 99999-0002',
  'A Clínica Bella Vida é uma clínica estética e de bem-estar premium. Tom de voz: sofisticado, acolhedor e profissional. Público-alvo: mulheres de 30-55 anos, classe média-alta. Diferenciais: tecnologia de ponta, equipe especializada, ambiente exclusivo. Serviços: botox, preenchimento, limpeza de pele, laser, drenagem linfática.',
  'active'
);
