# São Bento Dobrões

Loja de dobrões para capoeira. Mantém o layout, os temas claro/escuro, catálogo, filtros, carrinho, frete, checkout e administração da base original.

## Executar

```sh
npm ci
npm start
npm test
```

Requer Node 24 ou superior. Configure um ambiente próprio a partir de `.env.example`; não reutilize o banco de pedidos da outra loja. Pagamentos ficam desativados até configurar as credenciais, frete e identificação do vendedor. O catálogo inicia com quatro produtos e preço padrão de R$ 100 por item; preços, disponibilidade e estoque configurado são lidos do catálogo administrativo no servidor.

