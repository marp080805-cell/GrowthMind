export class WhatsAppService {
  constructor(
    private apiUrl: string,
    private token: string,
    private instanceName: string = 'default'
  ) {}

  async checkConnection(): Promise<{ connected: boolean; instanceName: string }> {
    const res = await fetch(`${this.apiUrl}/instance/connectionState/${this.instanceName}`, {
      headers: { apikey: this.token },
    })
    if (!res.ok) throw new Error(`Instância "${this.instanceName}" não encontrada ou token inválido (${res.status})`)
    const data = await res.json() as { instance?: { instanceName?: string; state?: string } }
    const state = data?.instance?.state
    if (state !== 'open') {
      throw new Error(`Instância "${this.instanceName}" não está conectada (estado: ${state ?? 'desconhecido'})`)
    }
    return { connected: true, instanceName: this.instanceName }
  }

  async sendMessage(to: string, message: string): Promise<void> {
    const res = await fetch(`${this.apiUrl}/message/sendText/${this.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.token,
      },
      body: JSON.stringify({
        number: to,
        text: message,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string }
      throw new Error(err.message || 'Erro ao enviar WhatsApp')
    }
  }

  async sendFile(to: string, fileUrl: string, caption?: string): Promise<void> {
    const res = await fetch(`${this.apiUrl}/message/sendMedia/${this.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.token,
      },
      body: JSON.stringify({
        number: to,
        mediatype: fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image' : 'document',
        media: fileUrl,
        caption: caption || '',
      }),
    })

    if (!res.ok) {
      throw new Error('Erro ao enviar arquivo WhatsApp')
    }
  }
}
