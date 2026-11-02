import {readConfig} from './config.js';
import {products} from './products.js';
import {openStore} from './store.js';
import {createGateway} from './services/mercadopago.js';
import {createApp} from './app.js';
import {createShippingProvider,createShipping} from './services/shipping.js';
const config=readConfig();
const store=openStore(config.databasePath);
const gateway=createGateway({...config,accessToken:config.mode==='disabled'?'':config.accessToken});
const shippingProvider=createShippingProvider();
const app=createApp({config,catalog:products,store,gateway,shipping:createShipping(store,shippingProvider)});
const server=app.listen(config.port,'127.0.0.1',()=>console.log(`Jewelry iniciada em ${config.baseURL}. Pagamentos: ${gateway.configured&&config.webhookSecret?'configurados — conferir catálogo':'desativados (configuração pendente)'}.`));
server.requestTimeout=15000;server.headersTimeout=10000;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>{store.close();process.exit(0);});});


