# Relatório de auditoria — São Bento Dobrões

**Data:** 31/10/2026  
**Repositório:** `Daviisk/sao-bento-store`  
**Base auditada:** `main` — `8b4f481bab50a88963b9de395a6975445ec76b87`  
**Branch de correções:** `fix/storefront-checkout-audit`  
**Commit atual:** `dcfa8f4675802891274c73ac7d342940eada632a`

## Escopo

Revisão estática dos fluxos de checkout personalizado, criação e acompanhamento de pedidos, pagamentos Mercado Pago, persistência de dados, integração Resend e testes relacionados.

## Problemas encontrados e correções aplicadas

### 1. E-mail opcional na interface, obrigatório no pagamento — corrigido

O formulário permitia continuar sem e-mail, mas os endpoints de Pix e cartão exigiam um endereço válido. Isso permitia criar um pedido e só depois falhar na etapa de pagamento.

**Correção:** campo de e-mail agora é obrigatório; o endereço é normalizado, validado e salvo no pedido. O backend também impede que o pagamento use um e-mail diferente daquele informado no pedido.

### 2. Histórico “Meus pedidos” sem links de acompanhamento — corrigido

A interface procurava pedidos com uma propriedade `url`, mas o checkout salvava apenas código e status. Além disso, o fluxo de cartão não registrava o pedido nessa lista.

**Correção:** após a criação do pedido, o checkout salva o link privado de acompanhamento para Pix e cartão. A gravação valida origem, rota, identificador e token antes de guardar o link. A tela agora exibe somente registros válidos.

### 3. Confirmação Resend ausente no checkout personalizado — corrigido no código

A integração de e-mail existente cobria o fluxo principal de pagamentos, mas o checkout personalizado usa as rotas da API Orders e não acionava a confirmação por e-mail.

**Correção:** o envio foi conectado à confirmação de pagamento recebida pelo webhook, pela consulta de status e pelo retorno imediato das operações Pix/cartão. O registro de envio e a chave de idempotência evitam reenvios duplicados. O e-mail do cliente agora fica persistido no pedido.

### 4. Nova chave de idempotência em cada tentativa de cartão — corrigido no frontend

Uma falha de rede seguida de nova tentativa gerava outra chave, o que poderia permitir que o provedor interpretasse o reenvio como uma cobrança diferente.

**Correção:** a chave da tentativa de cartão é reutilizada para o mesmo pedido e removida após a confirmação do pagamento.

### 5. Chave de criação do pedido não era invalidada ao editar os dados — corrigido

Alterar dados do formulário após uma tentativa poderia reutilizar a mesma chave de idempotência com um conteúdo diferente, gerando conflito.

**Correção:** alterações nos campos do checkout renovam a chave de criação do pedido.

## Arquivos alterados

- `frontend/js/shop-features.js`
- `backend/commerce.js`
- `backend/app.js`
- `tests/shop-features.test.js`
- `tests/commerce.test.js`

## Testes

Foram adicionadas/atualizadas verificações para:
- obrigatoriedade e envio do e-mail no checkout;
- persistência e validação do e-mail no pedido;
- gravação e exibição do link privado de acompanhamento.

**Limitação:** não executei `npm test` nem o teste de segurança localmente nesta sessão, pois não havia checkout local do repositório nem ambiente Node disponível para executar o conjunto. Não criei PR para evitar disparar um preview/deployment automático da Vercel. Portanto, as correções foram aplicadas no GitHub, mas ainda precisam passar pelo CI antes de serem integradas à `main`.

## Segurança e produção

- As alterações estão isoladas na branch `fix/storefront-checkout-audit`.
- A branch `main` não foi modificada.
- Nenhum deployment foi iniciado.
- Não foi realizado pagamento real nem teste de envio real pelo Resend.
- A versão publicada continua sem essas correções até aprovação, integração e deployment.

## Próximo passo recomendado

Executar `npm ci` e `npm test` na branch, revisar o resultado do CI e só então integrar. Depois, realizar um único deployment de produção e testar uma compra controlada de ponta a ponta (Pix, cartão e e-mail de confirmação).
