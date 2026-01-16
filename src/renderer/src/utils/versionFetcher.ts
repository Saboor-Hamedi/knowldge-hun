/**
 * Utility to fetch the app version from the main process via IPC.
 * Polls for window.api availability and retries on failure.
 */
export class VersionFetcher {
  private static readonly MAX_ATTEMPTS = 10
  private static readonly DELAY_MS = 200

  /**
   * Fetches the app version asynchronously, polling for API availability.
   * @returns Promise<string> The app version, or throws if unable to fetch.
   */
  static async fetchVersion(): Promise<string> {
    for (let attempt = 0; attempt < this.MAX_ATTEMPTS; attempt++) {
      const winTyped = window as unknown as {
        api?: { getAppVersion?: () => Promise<string> }
      }
      const api = winTyped.api
      if (api && typeof api.getAppVersion === 'function') {
        try {
          const version = await api.getAppVersion()
          if (version) return version
          throw new Error('Empty version returned')
        } catch (error) {
          console.warn(`VersionFetcher: Attempt ${attempt + 1} failed:`, error)
          if (attempt === this.MAX_ATTEMPTS - 1) throw error
        }
      }
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, this.DELAY_MS))
    }
    throw new Error('window.api.getAppVersion not available after retries')
  }
}