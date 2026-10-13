# Privacidade: implementação e pendências

Revisão técnica em 2026-09-27. Isto não é certificação de conformidade jurídica.

## Implementado
- Página /frontend/privacidade.html e aviso no formulário de entrega.
- Exportação autenticada por sessão, com filtro de proprietário no banco, sem notas administrativas, chaves ou payloads internos. Não busca por e-mail informado pelo visitante.
- Revogação real da sessão no banco, protegida por origem e CSRF; remoção de cotações da sessão e dados locais da loja. Não elimina pedidos nem revoga links de acompanhamento.
- Configuração pública restrita a PRIVACY_CONTROLLER e PRIVACY_EMAIL. Não incluir segredos nessas variáveis.
- Supabase dobroes-de-fe: 11 tabelas com RLS e sem concessões anon/authenticated; sem políticas de leitura pública, intencionalmente, pois o servidor usa PostgreSQL diretamente.
- Defaults do papel postgres alterados: novas tabelas/sequências em public não concedem privilégios anon/authenticated. Novas funções não concedem EXECUTE a PUBLIC; grants por função devem ser explícitos. Novos criadores de objetos exigem revisão própria.

## Procedimento para solicitações
1. Receber solicitação pelo canal oficial; registrar protocolo, tipo, data e prazo aplicável, sem copiar documentos em logs.
2. Verificar identidade proporcionalmente; não confiar em e-mail/telefone digitado nem em posse de um número de pedido. Não solicitar cartão/senha.
3. Identificar dados em customers, orders.document, shipping_quotes, registros operacionais, prestadores e backups. Exportação da sessão é parcial, não substitui esse levantamento.
4. Acesso/correção/eliminação: atender conforme hipótese legal; comunicar justificativa para retenções. Revisar dados duplicados no JSON do pedido. Não apagar registros fiscais, pagamentos pendentes, disputas ou comprovantes automaticamente.
5. Registrar conclusão e encaminhar correções/eliminação aos operadores quando aplicável.

## Retenção e incidentes
Definir matriz aprovada por finalidade: cadastro, pedido/fiscal, cotação, logs/auditoria, solicitações e backups. Sessões expiram em 7 dias e são limpas quando novas sessões são criadas; cotações possuem rotina de expiração. Isso não equivale a limpeza diária agendada.
Antes de automatizar exclusões: estabelecer prazo/base legal, modo de simulação, backup com acesso restrito, teste de restauração e tratamento das cópias restauradas. Não foi executada exclusão em massa.
Em incidente: conter acesso, preservar evidências mínimas, avaliar risco aos titulares, consultar as regras atuais da ANPD e registrar decisões/comunicações. Não expor dados pessoais em tickets públicos.

## Últimas pendências do responsável
- Preencher PRIVACY_CONTROLLER (identificação do controlador) e PRIVACY_EMAIL (canal efetivamente monitorado) na Vercel e fazer novo deploy.
- Aprovar bases legais, matriz de retenção e aviso final; avaliar tratamento de informação capaz de revelar convicção religiosa. Não usar compras para inferir religião ou segmentar anúncios.
- Revisar contratos/DPA e subprocessadores Vercel, Supabase, Mercado Pago e frete; mecanismos de transferência internacional. Banco em São Paulo não prova residência de todos os dados.
- Confirmar responsáveis pelo atendimento e incidentes; MFA nas contas administrativas, revisão de acessos e política de backups.
- Planejar atualização do Postgres informado pelo Supabase (17.6.1.166) após revisar changelog de segurança de 2026-09-25; não atualizamos infraestrutura sem janela/teste de restauração.

Referências: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm ; https://supabase.com/docs/guides/api/securing-your-api ; https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Reforço de segurança e comércio eletrônico — 2026-09-27
- Novos links assinados de acompanhamento expiram em 90 dias; tokens via fragmento no navegador e cabeçalho Authorization nas APIs. Links antigos têm transição até 2026-10-27 00:00 UTC. Não há renovação automática via link público. Cliente sem sessão/link válido precisa de atendimento humano e verificação de identidade para reemissão.
- Link de acompanhamento mostra somente cidade/UF; não expõe nome nem endereço completo. O link continua sendo uma credencial: quem o possuir poderá consultar a compra e registrar solicitações.
- Logout administrativo revoga a sessão no servidor. Sessões administrativas antigas exigirão novo login após a publicação.
- Solicitações de arrependimento/defeito/privacidade são registradas com protocolo no pedido, inclusive se pago. O painel exibe atendimento pendente. O responsável deve consultar diariamente, responder pelo contato do cliente em até 5 dias (Decreto 7.962/2013) e executar devolução/estorno cabível no processador. Não foi implementado estorno automático nem envio de mensagens.
- Solicitações idênticas abertas retornam o mesmo protocolo. Atualizações do pedido preservam protocolos existentes. O tratamento e a conclusão devem ser documentados nas observações administrativas; não coletar documentos desnecessários.
- Página /frontend/termos.html apresenta condições de compra e direitos. Preencher STORE_LEGAL_NAME, STORE_DOCUMENT (CPF/CNPJ aplicável), STORE_ADDRESS, STORE_SUPPORT_EMAIL, STORE_SUPPORT_PHONE. Validar características dos produtos (material, medidas, peso, cuidados, riscos, disponibilidade) e prazo de preparação na oferta. Essas informações não podem ser inventadas pelo desenvolvedor.
- Correções de escape HTML nas telas de pagamento, com teste de payload malicioso. Auditoria npm de produção: zero vulnerabilidades conhecidas no momento da consulta; isso não comprova ausência de falhas.
- Limites atuais: não houve pentest independente, configuração de WAF distribuído, MFA do painel, testes reais de chargeback/3DS, auditoria fiscal, revisão contratual ou prova de restauração de backup. Limites Express em memória não substituem WAF distribuído na Vercel. Gestão de incidentes, MFA nas contas de infraestrutura, emissão fiscal e atendimento continuam responsabilidades operacionais.

Fontes: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm ; https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm ; https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

## Exclusão manual do painel — 2026-09-27
A rotina de exclusão automática de pedidos abandonados foi desativada (inclusive chamadas legadas). ABANDONED_ORDER_TIMEOUT_MINUTES não é mais utilizada. No detalhe do pedido, “Excluir do painel” exige confirmação do número e autenticação administrativa. Registra adminDeletedAt, retira o pedido da listagem/indicadores de pedidos e preserva dados para conciliação, acompanhamento e atendimento. Não representa cancelamento, reembolso nem eliminação LGPD; a retenção no banco continua sujeita à política aprovada pelo responsável. Histórico de clientes permanece preservado.

