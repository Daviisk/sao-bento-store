(()=>{'use strict';document.documentElement.dataset.theme='light';
try{localStorage.removeItem('sao-bento.theme');}catch{}
fetch('/api/legal/config',{credentials:'same-origin',cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(({seller:s})=>{const box=document.getElementById('seller');const labels={name:'Fornecedor',document:'CPF/CNPJ',address:'Endereço',email:'Atendimento por e-mail',phone:'Telefone'};if(!s)return;const complete=['name','document','address','email'].every(k=>s[k]);if(complete)box.replaceChildren();for(const [key,label] of Object.entries(labels)){if(!s[key])continue;const p=document.createElement('p');p.textContent=label+': '+s[key];box.append(p);}}).catch(()=>{});
})();

