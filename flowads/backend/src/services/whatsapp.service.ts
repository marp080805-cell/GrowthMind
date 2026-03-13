export class WhatsAppService {
  constructor(
    private apiUrl: string,
    private token: string
  ) {}

  async sendMessage(to: string, message: string): Promise<void> {
    const res = await fetch(`${this.apiUrl}/message/sendText/default`, {
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
    const res = await fetch(`${this.apiUrl}/message/sendMedia/default`, {
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
