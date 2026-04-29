import sharedConfig from "../../../shared-config.json";

export interface ContractAddresses {
  credentialNFT: string;
  reputationToken: string;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
}

export interface SharedConfig {
  contracts: ContractAddresses;
  network: NetworkConfig;
}

export function getContractAddresses(): ContractAddresses {
  return sharedConfig.contracts;
}

export function getNetworkConfig(): NetworkConfig {
  return sharedConfig.network;
}
