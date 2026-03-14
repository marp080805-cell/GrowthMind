# Regras do Projeto GrowthMind

## Após cada alteração de código

Sempre que fizer qualquer alteração no código:

1. **Fazer commit e push automaticamente** no Codespace — sem precisar pedir. Commitar apenas os arquivos relevantes à alteração.

2. **Finalizar com "Próximo passo:"** com instruções completas e prontas para o usuário, incluindo:
   - Comando exato para atualizar na VPS (com o path correto): `cd /home/user/GrowthMind/flowads && git pull && docker compose build --no-cache && docker compose up -d`
   - Migration a aplicar, funcionalidade a testar, ou qualquer outra ação necessária

Seja específico e completo: comandos prontos para copiar e colar, não instruções genéricas.
