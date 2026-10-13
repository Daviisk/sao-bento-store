// Automatic order deletion is disabled. Kept as safe no-ops for old callers.
export function orderCleanupTimeoutMs(){return null;}
export async function deleteAbandonedOrders(){return 0;}
export function createOrderCleanupRunner(){return async()=>0;}

