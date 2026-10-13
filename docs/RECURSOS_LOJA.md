# São Bento Dobrões — funcionalidades

Personalização: material, acabamento, texto até 80 caracteres, arte JPG/PNG/WebP até 1 MB. Kits de um ou três dobrões com escolhas individuais e bolsa. Total calculado pelo servidor com preços do catálogo.

Pedidos novos são solicitações para confirmação pela loja, sem cobrança nesta etapa. Pagamento e frete online permanecem sem credenciais ativadas. O acompanhamento privado mostra recebimento, arte, produção, envio e entrega; a loja confirma manualmente pagamentos reais recebidos.

Painel `/admin`: produtos, preços, fotos, galerias, prazos, estoque por opção, pedidos personalizados, avaliações e orçamentos de grupos. Valores iniciais: dobrões R$150; bolsas individual e Trio R$100. Estoque inicial não informado, exibido como disponibilidade a confirmar. Baixa atômica na confirmação; cancelamento devolve somente unidades realmente baixadas.

Avaliações somente de pedidos pagos e entregues, uma por produto/pedido, com foto opcional e moderação. Nenhuma avaliação fictícia. Grupos podem enviar quantidade, arte e detalhes; o painel acompanha o atendimento.

Persistência no schema privado `sao_bento_store`, com usuário de banco exclusivo, sem alteração das tabelas da loja original. Sessões HttpOnly, origem restrita, CSRF, limite de upload e dados administrativos excluídos da API pública. Credenciais de acompanhamento ficam no fragmento do link.

Testes: administração, CSRF, cálculo autoritativo, idempotência, concorrência de estoque, cancelamento, avaliações verificadas, personalização, kit Trio, busca sem duplicações, galeria e zoom.

As fotos atuais são tratadas a partir das referências fornecidas. Nenhum vídeo foi inventado ou adicionado: é necessário fornecer um vídeo real dos produtos.
