import { marketplaceRepository } from '../repositories/marketplace.repository.js';
import { HeartbeatInput, SearchInput } from '../schema/marketplace.schema.js';

export class MarketplaceService {
  async registerHeartbeat(sellerId: string, input: HeartbeatInput) {
    return await marketplaceRepository.updateHeartbeat(sellerId, input);
  }

  async findNearbySellers(input: SearchInput) {
    return await marketplaceRepository.searchSellers(input);
  }
}

export const marketplaceService = new MarketplaceService();
