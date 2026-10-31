# Relatório de auditoria técnica — São Bento Dobrões

**Repositório:** Daviisk/sao-bento-store  
**Base auditada:** main em 31/10/2026  
**Branch de correção:** fix/audit-checkout-email  
**Escopo:** checkout público, pagamentos Mercado Pago (Orders API), notificações Resend, persistência de pedidos e imagens da galeria.

## Problemas encontrados e correções aplicadas

### 1. Nome da tabela PostgreSQL incompatível com o Supabase — corrigido
A inspeção somente de leitura do projeto Supabase `dobroes-de-fe` confirmou que a tabela existente é `public.medalhas_commerce_documents`; a implementação PostgreSQL consultava `public.commerce_documents`, que não existe nesse banco. Isso fazia as rotas do catálogo e dos pedidos comerciais falharem ao acessar o armazenamento.
- O adaptador PostgreSQL agora usa a tabela que realmente existe no projeto.
- Adicionado teste de regressão para impedir que o nome volte a divergir.

### 2. E-mail apresentado como opcional no checkout — corrigido
A interface permitia finalizar sem e-mail, mas as rotas de Pix e cartão exigiam e-mail válido para criar a cobrança no Mercado Pago. Isso gerava falha apenas depois de o cliente preencher o checkout.
- Campo de e-mail agora é obrigatório no formulário.
- Teste de interface atualizado para validar o atributo required.

### 3. Chave de idempotência do cartão variava a cada tentativa — corrigido
O checkout legado gerava uma chave nova no navegador em cada tentativa. Em caso de timeout após o provedor receber a cobrança, uma repetição poderia iniciar outra cobrança.
- A chave agora é derivada no servidor do tipo de pagamento e do ID do pedido.
- Repetições do mesmo pedido reutilizam a mesma chave mesmo se o navegador enviar outro identificador.
- Adicionado teste de regressão simulando timeout e repetição.

### 4. Resend não era acionado pelo checkout comercial ativo — corrigido
A integração anterior notificava pagamentos do fluxo Payments API, mas a interface principal usa as rotas /api/commerce e Mercado Pago Orders. O fluxo comercial não acionava a confirmação de e-mail.
- E-mail do cliente e dados de frete agora são persistidos no pedido comercial ao vincular a cobrança.
- Confirmação Resend é acionada após confirmação do pagamento imediato, webhook ou consulta de status.
- O ID do e-mail e horário de envio são persistidos para impedir reenvio.
- A chave de idempotência do Resend continua baseada no ID do pedido.

### 5. Foto de galeria vazia — corrigido
O arquivo frontend/images/bolsa-couro-aberta-prof-v2.webp existia com zero bytes e era referenciado na galeria da bolsa.
- Referências foram substituídas por frontend/images/bolsa-couro-aberta.jpg, arquivo JPEG existente.
- Adicionado teste para verificar conteúdo e assinatura JPEG do arquivo e impedir regressão.

## Verificações

- Revisão estática dos módulos de checkout, validação, configuração, Mercado Pago, webhook, Resend, armazenamento e interface.
- A árvore do repositório foi examinada para arquivos de imagem vazios; foi encontrado um único arquivo vazio, já substituído nas referências.
- Os testes de regressão foram adicionados ao conjunto npm test.

## Limitações e itens ainda não confirmados

- GitHub Actions (execução #367): `npm test` concluído com **126 testes aprovados e 0 falhas**.
- O mapeamento da tabela PostgreSQL foi comparado com o catálogo real do projeto Supabase conectado; a consulta foi somente de leitura.
- Não foram executadas transações reais com cartão/Pix nem envio real de e-mail; os testes novos usam respostas simuladas.
- A auditoria de código não substitui teste de ponta a ponta em navegador, com credenciais reais e ambiente de homologação.
- A verificação de preview da Vercel foi bloqueada pelo limite diário de builds da conta; isso não é uma falha do código.
- Nenhum deployment de produção ou alteração na versão publicada foi realizado nesta auditoria.

## Arquivos alterados

- backend/app.js
- backend/commerce.js
- backend/commerce-store.js
- frontend/js/shop-features.js
- frontend/js/storefront.js
- tests/shop-features.test.js
- tests/commerce-payment.test.js
- tests/commerce-store.test.js
- AUDITORIA_TECNICA.md
