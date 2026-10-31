# São Bento Dobrões — funcionalidades

Personalização: material, acabamento, texto até 80 caracteres, arte JPG/PNG/WebP até 1 MB. Kits de um ou três dobrões com escolhas individuais e bolsa. Total calculado pelo servidor com preços do catálogo.

Pedidos novos são solicitações para confirmação pela loja, sem cobrança nesta etapa. Pagamento e frete online permanecem sem credenciais ativadas. O acompanhamento privado mostra recebimento, arte, produção, envio e entrega; a loja confirma manualmente pagamentos reais recebidos.



Persistência no schema privado `sao_bento_store`, com usuário de banco exclusivo, sem alteração das tabelas da loja original. Sessões HttpOnly, origem restrita, CSRF, limite de upload e dados administrativos excluídos da API pública. Credenciais de acompanhamento ficam no fragmento do link.


As fotos atuais são tratadas a partir das referências fornecidas. Nenhum vídeo foi inventado ou adicionado: é necessário fornecer um vídeo real dos produtos.
