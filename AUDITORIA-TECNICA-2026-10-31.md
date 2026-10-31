# Relatório de auditoria técnica — São Bento Dobrões

**Data:** 31/10/2026  
**Repositório:** Daviisk/sao-bento-store  
**Base auditada:** main, commit 8b4f481bab50a88963b9de3956975445ec76b87

## Escopo

Revisão estática do backend Express, checkout CardForm/Pix, catálogo administrativo, validação de carrinho, frete, persistência e testes automatizados. Não foram usados dados reais de clientes nem realizadas cobranças.

## Problemas corrigidos nesta revisão

1. **Catálogo divergente entre vitrine e checkout.** A API pública de produtos usava o catálogo administrativo, mas cotação de frete e preparação de pagamento validavam itens e calculavam valores usando a lista estática. Isso podia mostrar um preço e cobrar outro, ou deixar passar produto desativado. As rotas agora consultam o catálogo atual do servidor para validar produtos e calcular o total.
2. **Pedido pendente reutilizado após alteração de preço.** A chave de reutilização do pedido não incluía os preços vigentes. Agora o hash do checkout incorpora o preço de cada produto; uma alteração de preço gera uma nova preparação e não reaproveita um pedido pendente com valor antigo.
3. **Estoque configurado não era validado no checkout principal.** A validação do carrinho agora rejeita quantidades acima do estoque disponível quando a opção de venda sob encomenda está desativada.

## Testes adicionados/ajustados

- Alteração administrativa de preço refletida no total do CardForm.
- Alteração de preço cria novo pedido em vez de reaproveitar pedido pendente com valor antigo.
- Estoque zero bloqueia a preparação de pagamento quando não há venda sob encomenda.
- Produto desativado é recusado já na cotação de frete.
- Expectativas dos testes existentes alinhadas ao preço padrão atual de R$ 100.

## Pendências e limites identificados

- **Reserva de estoque ainda não é atômica no fluxo CardForm/Pix.** A revisão adiciona a validação do estoque atual, mas não implementa reserva/decremento transacional no momento da preparação e liberação em abandono/falha. Em compras simultâneas, ainda pode haver overselling se a loja usar estoque finito. Recomenda-se implementar reserva com expiração e confirmação/liberação ligada ao estado do pagamento antes de operar com estoque controlado.
- **Testes automatizados não foram executados neste ambiente.** O acesso de rede do ambiente de trabalho não conseguiu clonar o repositório; os testes foram atualizados no código, mas ainda precisam rodar em CI ou ambiente Node 24 com `npm ci && npm test`.
- **Integrações reais não foram exercitadas:** Mercado Pago (Pix, cartão, 3DS e webhooks), Resend e provedor de frete precisam de teste controlado com credenciais e transações de teste.
- **Migração futura para Render:** `backend/server.js` escuta em `127.0.0.1`; para executar como serviço web no Render, deverá escutar em `0.0.0.0`. A entrada atual da Vercel usa `backend/vercel-app.js`, portanto essa observação não altera a execução atual na Vercel.

## Publicação

Nenhum deployment de produção foi iniciado nesta auditoria. As correções ficam isoladas em uma branch para revisão; a publicação deve ocorrer somente depois de os testes passarem e das pendências operacionais serem avaliadas.
