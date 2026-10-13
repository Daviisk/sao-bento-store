// Validate tracking requests before touching storage or the payment provider.
export function trackingRequestError(req,baseURL){
 const action=new URL(req.url,'https://tracking.invalid').searchParams.get('action');
 const modifying=['cancel','support'].includes(action);
 const allowed=modifying?'POST':'GET';
 if(req.method!==allowed)return {status:405,error:'method_not_allowed',message:'Método não permitido.',allow:allowed};
 if(modifying&&(req.headers.origin!==baseURL||req.headers['sec-fetch-site']==='cross-site'))
  return {status:403,error:'origin_forbidden',message:'Origem não permitida.'};
 return null;
}


