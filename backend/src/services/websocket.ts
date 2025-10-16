import WebSocket from 'ws';
import { TodoistService } from './todoist';

export class SyncWebSocketService {
  private wss: WebSocket.Server;
  private todoistService: TodoistService;
  private connectedClients: Set<WebSocket> = new Set();

  constructor(wss: WebSocket.Server, todoistToken: string) {
    this.wss = wss;
    this.todoistService = new TodoistService(todoistToken);

    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Client connected to sync WebSocket');
      this.connectedClients.add(ws);

      ws.on('message', async (message: WebSocket.Data) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
          this.sendToClient(ws, {
            type: 'error',
            message: 'Invalid message format'
          });
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected from sync WebSocket');
        this.connectedClients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.connectedClients.delete(ws);
      });

      // Send initial connection confirmation
      this.sendToClient(ws, {
        type: 'connected',
        message: 'Connected to real-time sync'
      });
    });
  }

  private async handleMessage(ws: WebSocket, data: any) {
    switch (data.type) {
      case 'START_AUTO_SYNC':
        await this.startAutoSync();
        break;

      case 'STOP_AUTO_SYNC':
        this.stopAutoSync();
        break;

      case 'FORCE_SYNC':
        await this.forceSyncToTodoist();
        break;

      default:
        this.sendToClient(ws, {
          type: 'error',
          message: 'Unknown message type'
        });
    }
  }

  private async startAutoSync() {
    console.log('Starting automatic sync...');

    try {
      // Upload any pending local changes first
      const uploadResults = await this.todoistService.uploadToTodoist();

      // Then sync from Todoist
      const projectsResults = await this.todoistService.syncProjectsFromTodoist();
      const tasksResults = await this.todoistService.syncTasksFromTodoist();

      const allResults = [...uploadResults, ...projectsResults, ...tasksResults];

      // Broadcast results to all connected clients
      this.broadcast({
        type: 'AUTO_SYNC_COMPLETED',
        results: allResults,
        summary: {
          total: allResults.length,
          uploaded: uploadResults.length,
          downloaded: projectsResults.length + tasksResults.length,
          errors: allResults.filter(r => r.action === 'error').length,
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Auto sync error:', error);
      this.broadcast({
        type: 'AUTO_SYNC_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  private stopAutoSync() {
    console.log('Stopping automatic sync');
    this.broadcast({
      type: 'AUTO_SYNC_STOPPED',
      timestamp: new Date().toISOString()
    });
  }

  private async forceSyncToTodoist() {
    console.log('Force syncing to Todoist...');

    try {
      const results = await this.todoistService.uploadToTodoist();

      this.broadcast({
        type: 'FORCE_SYNC_COMPLETED',
        results,
        summary: {
          total: results.length,
          uploaded: results.filter(r => r.action === 'uploaded').length,
          errors: results.filter(r => r.action === 'error').length,
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Force sync error:', error);
      this.broadcast({
        type: 'FORCE_SYNC_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  private sendToClient(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private broadcast(data: any) {
    const message = JSON.stringify(data);
    this.connectedClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  // Method to trigger sync when database changes are detected
  public async triggerSyncOnChange() {
    console.log(`Database change detected. Connected clients: ${this.connectedClients.size}`);
    if (this.connectedClients.size > 0) {
      console.log('Triggering real-time sync...');
      await this.startAutoSync();
    } else {
      console.log('No connected clients, skipping real-time sync');
    }
  }

  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}