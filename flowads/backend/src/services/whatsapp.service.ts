export class WhatsAppService {
  constructor(
    private apiUrl: string,
    private token: string,
    private instanceName: string = 'default'
  ) {}

  async checkConnection(): Promise<{ connected: boolean; instanceName: string }> {
    const res = await fetch(`${this.apiUrl}/instance/fetchInstances`, {
      headers: { apikey: this.token },
    })
    if (!res.ok) throw new Error('URL ou token inválido')
    const instances = await res.json() as Array<{ instance?: { instanceName?: string; state?: string } }>
    const target = instances.find(
      (i) => i.instance?.instanceName === this.instanceName
    ) || instances[0]
    if (!target?.instance?.instanceName) throw new Error('Nenhuma instância encontrada')
    if (target.instance.state !== 'open') {
      throw new Error(`Instância "${target.instance.instanceName}" não está conectada (estado: ${target.instance.state})`)
    }
    return { connected: true, instanceName: target.instance.instanceName as string }
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
