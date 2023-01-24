import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";


const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: {
    hardhat: {
      accounts: {
        count: 20,
        mnemonic: "test test test test test test test test test test test junk",
      },
      // chainId: 1337,
      chainId: 137, // MATIC FORK
      forking: {
        url: process.env.ALCHEMY_MATIC_URL || "https://polygon-rpc.com/",
        blockNumber : 35162000
      },
      loggingEnabled: true
    },
    matic: {
      url: process.env.MATIC_URL || "https://polygon-rpc.com/",
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
      }    },
    mumbai : {
      url: process.env.MUMBAI_URL || "https://rpc-mumbai.maticvigil.com/",
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
      }
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  typechain: {
    alwaysGenerateOverloads: true,
  },
};

export default config;
