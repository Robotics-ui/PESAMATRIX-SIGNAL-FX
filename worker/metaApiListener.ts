import MetaApi, { SynchronizationListener, MetatraderPosition, MetatraderPendingOrder } from 'metaapi.cloud-sdk';
import { providerEventQueue, QUEUE_NAMES } from '../lib/queue/config';
import logger from '../lib/utils/logger';

export class MetaApiStreamingContext implements SynchronizationListener {
  constructor(
    private providerId: string, 
    private metaApiAccountId: string
  ) {}

  async onPositionOpened(instanceIndex: number, position: MetatraderPosition): Promise<void> {
    logger.info(`[MetaApi Event] Position Opened - Master: ${this.metaApiAccountId}, Trade ID: ${position.id}`);
    await providerEventQueue.add('position-opened', {
      type: 'POSITION_OPENED',
      providerId: this.providerId,
      masterAccountId: this.metaApiAccountId,
      position,
    }, { jobId: `open_${position.id}_${Date.now()}` });
  }

  async onPositionModified(instanceIndex: number, position: MetatraderPosition): Promise<void> {
    logger.info(`[MetaApi Event] Position Modified - Master: ${this.metaApiAccountId}, Trade ID: ${position.id}`);
    await providerEventQueue.add('position-modified', {
      type: 'POSITION_MODIFIED',
      providerId: this.providerId,
      masterAccountId: this.metaApiAccountId,
      position,
    }, { jobId: `modify_${position.id}_${position.updateSequenceNumber || Date.now()}` });
  }

  async onPositionClosed(instanceIndex: number, positionId: string): Promise<void> {
    logger.info(`[MetaApi Event] Position Closed - Master: ${this.metaApiAccountId}, Trade ID: ${positionId}`);
    await providerEventQueue.add('position-closed', {
      type: 'POSITION_CLOSED',
      providerId: this.providerId,
      masterAccountId: this.metaApiAccountId,
      positionId,
    }, { jobId: `close_${positionId}_${Date.now()}` });
  }

  async onPendingOrderCreated(instanceIndex: number, order: MetatraderPendingOrder): Promise<void> {
    await providerEventQueue.add('order-created', {
      type: 'PENDING_ORDER_CREATED',
      providerId: this.providerId,
      masterAccountId: this.metaApiAccountId,
      order,
    });
  }

  async onPendingOrderModified(instanceIndex: number, order: MetatraderPendingOrder): Promise<void> {
    await providerEventQueue.add('order-modified', {
      type: 'PENDING_ORDER_MODIFIED',
      providerId: this.providerId,
      masterAccountId: this.metaApiAccountId,
      order,
    });
  }

  async onPendingOrderCompleted(instanceIndex: number, orderId: string): Promise<void> {
    await providerEventQueue.add('order-completed', {
      type: 'PENDING_ORDER_COMPLETED',
      providerId: this.providerId,
      masterAccountId: this.metaApiAccountId,
      orderId,
    });
  }

  // Mandatory implementation overrides for interface compliance
  async onBrokerConnectionStatusChanged(instanceIndex: number, status: string): Promise<void> {}
  async onSynchronizationStatusChanged(instanceIndex: number, status: string): Promise<void> {}
  async onHistoryOrdersSynchronized(instanceIndex: number, historyOrders: any): Promise<void> {}
  async onHistoryDealsSynchronized(instanceIndex: number, historyDeals: any): Promise<void> {}
  async onDealAdded(instanceIndex: number, deal: any): Promise<void> {}
  async onOrderAdded(instanceIndex: number, order: any): Promise<void> {}
  async onOrderCompleted(instanceIndex: number, orderId: string): Promise<void> {}
  async onError(error: Error): Promise<void> {
    logger.error(`Listener error on account ${this.metaApiAccountId}: ${error.message}`);
  }
}
