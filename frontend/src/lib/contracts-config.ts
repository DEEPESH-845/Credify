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

/**
 * Read contract addresses from environment variables.
 * These are set as NEXT_PUBLIC_ vars so they're available at build time.
 */
export function getContractAddresses(): ContractAddresses {
  return {
    credentialNFT:
      process.env.NEXT_PUBLIC_CREDENTIAL_NFT_ADDRESS ||
      "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    reputationToken:
      process.env.NEXT_PUBLIC_REPUTATION_TOKEN_ADDRESS ||
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  };
}

export function getNetworkConfig(): NetworkConfig {
  return {
    chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337", 10),
    name: process.env.NEXT_PUBLIC_NETWORK_NAME || "localhost",
  };
}
