export class DestructionProtocol {
  private static hotkeySequence = ['Control', 'Shift', 'KeyD', 'KeyD'];
  private static keySequence: string[] = [];
  private static isInitialized = false;
  
  static init() {
    if (this.isInitialized) return;
    
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.isInitialized = true;
    
    console.log('🚨 Destruction Protocol initialized');
    console.log('Hotkey sequence: Ctrl + Shift + D + D');
  }
  
  private static handleKeyDown(event: KeyboardEvent) {
    // Add current key to sequence
    this.keySequence.push(event.code);
    
    // Keep only the last 4 keys
    if (this.keySequence.length > this.hotkeySequence.length) {
      this.keySequence.shift();
    }
    
    // Check if destruction sequence is matched
    if (this.isDestructionSequence()) {
      event.preventDefault();
      this.confirmDestruction();
    }
  }
  
  private static isDestructionSequence(): boolean {
    return this.keySequence.length === this.hotkeySequence.length &&
           this.keySequence.every((key, index) => key === this.hotkeySequence[index]);
  }
  
  private static async confirmDestruction() {
    // Reset sequence to prevent multiple triggers
    this.keySequence = [];
    
    const confirmed = window.confirm(
      '⚠️ DESTRUCTION PROTOCOL ACTIVATED ⚠️\n\n' +
      'This will permanently destroy all local data including:\n' +
      '• Authentication tokens\n' +
      '• Cached messages\n' +
      '• Stored files\n' +
      '• Session data\n' +
      '• Browser storage\n\n' +
      'This action cannot be undone. Continue?'
    );
    
    if (confirmed) {
      await this.executeDestruction();
    }
  }
  
  private static async executeDestruction() {
    console.log('🔥 EXECUTING DESTRUCTION PROTOCOL');
    
    try {
      // Show destruction animation
      this.showDestructionEffect();
      
      // Clear all local storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos) : c;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });
      
      // Clear IndexedDB
      await this.clearIndexedDB();
      
      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Log destruction event
      console.log('🔥 LOCAL DATA DESTRUCTION COMPLETE');
      
      // Redirect to destruction confirmation page
      setTimeout(() => {
        window.location.href = '/destroyed';
      }, 2000);
      
    } catch (error) {
      console.error('❌ Destruction protocol error:', error);
      alert('Destruction protocol encountered an error. Please clear browser data manually.');
    }
  }
  
  private static showDestructionEffect() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(45deg, #dc2626, #7f1d1d);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      animation: destruction 2s ease-in-out;
    `;
    
    // Add destruction message
    const message = document.createElement('div');
    message.style.cssText = `
      color: white;
      font-size: 2rem;
      font-weight: bold;
      text-align: center;
      animation: pulse 0.5s infinite;
    `;
    message.innerHTML = `
      <div>🔥 DESTRUCTION PROTOCOL ACTIVE 🔥</div>
      <div style="font-size: 1rem; margin-top: 1rem;">
        Eliminating all traces...
      </div>
    `;
    
    overlay.appendChild(message);
    document.body.appendChild(overlay);
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes destruction {
        0% { opacity: 0; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.1); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
  }
  
  private static async clearIndexedDB() {
    try {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map(db => {
          if (db.name) {
            return new Promise<void>((resolve, reject) => {
              const deleteReq = indexedDB.deleteDatabase(db.name!);
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => reject(deleteReq.error);
            });
          }
          return Promise.resolve();
        })
      );
    } catch (error) {
      console.warn('Failed to clear IndexedDB:', error);
    }
  }
  
  static cleanup() {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.isInitialized = false;
    this.keySequence = [];
  }
}