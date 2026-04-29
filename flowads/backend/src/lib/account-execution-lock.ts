/**
 * Mutex simples para executar operações Meta serialmente por account
 * Garante que múltiplas automações rodando simultaneamente no mesmo account
 * não causam burst detection
 */

interface LockInfo {
  locked: boolean
  queue: Array<{
    resolve: () => void
    reject: (err: Error) => void
  }>
}

const accountLocks = new Map<string, LockInfo>()

/**
 * Adquirir lock de account (ou aguardar na fila)
 */
export async function acquireAccountLock(adAccountId: string): Promise<void> {
  let lock = accountLocks.get(adAccountId)

  if (!lock) {
    lock = { locked: false, queue: [] }
    accountLocks.set(adAccountId, lock)
  }

  if (!lock.locked) {
    lock.locked = true
    return
  }

  // Account está locked, aguardar na fila
  return new Promise((resolve, reject) => {
    lock!.queue.push({ resolve, reject })
  })
}

/**
 * Liberar lock e processar próxima operação da fila
 */
export function releaseAccountLock(adAccountId: string): void {
  const lock = accountLocks.get(adAccountId)
  if (!lock) return

  const nextWaiting = lock.queue.shift()
  if (nextWaiting) {
    // Próxima operação começa imediatamente
    nextWaiting.resolve()
  } else {
    // Ninguém na fila, liberar lock
    lock.locked = false
  }
}

/**
 * Executar função com lock de account
 * Garante execução serial por account
 */
export async function withAccountLock<T>(
  adAccountId: string,
  fn: () => Promise<T>
): Promise<T> {
  await acquireAccountLock(adAccountId)
  try {
    return await fn()
  } finally {
    releaseAccountLock(adAccountId)
  }
}

/**
 * Informação de debug: quantas automações estão aguardando por account
 */
export function getAccountLockStatus(adAccountId: string): { locked: boolean; waiting: number } {
  const lock = accountLocks.get(adAccountId)
  return {
    locked: lock?.locked ?? false,
    waiting: lock?.queue.length ?? 0,
  }
}

/**
 * Reset de todos os locks (útil para testes)
 */
export function resetAllLocks(): void {
  accountLocks.clear()
}
