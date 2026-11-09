declare module 'midtrans-client' {
  export class Snap {
    constructor(config: { isProduction: boolean; serverKey: string; clientKey: string });
    createTransaction(payload: Record<string, unknown>): Promise<{ token: string; redirect_url: string }>; 
  }
}
