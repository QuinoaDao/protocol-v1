import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe('IProduct', () => {
  const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
  const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

  const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
  const wethAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
  const ghstAddress = "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7";
  const quickAddress = "0xB5C064F955D8e7F38fE0460C556a72987494eE17";
  const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

  const maticOracle = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
  const ethOracle = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
  const ghstOracle = "0xDD229Ce42f11D8Ee7fFf29bDB71C7b81352e11be";
  const quickOracle = "0xa058689f4bCa95208bba3F265674AE95dED75B6D";
  const usdcOracle = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";

  beforeEach('Contracts setting', async () => {
    // Deploy the contract to the test network
    const Product = await ethers.getContractFactory("Product");
    const Strategy = await ethers.getContractFactory("Strategy");
    const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");
    const SwapModule = await ethers.getContractFactory("SwapModule");

    const [dac, nonDac] = await ethers.getSigners();

    const swapModule = await SwapModule.deploy(quickSwapFactory, quickSwapRouter);
    const usdPriceModule = await UsdPriceModule.deploy();

    const product = await Product.deploy();

    const wmaticStrategy = await Strategy.deploy(wmaticAddress, product.address);
    const wethStrategy = await Strategy.deploy(wethAddress, product.address);
    const ghstStrategy = await Strategy.deploy(ghstAddress, product.address);
    const quickStrategy = await Strategy.deploy(quickAddress, product.address);
    const usdcStrategy = await Strategy.deploy(usdcAddress, product.address);

    const badStrategy1 = await Strategy.deploy()

  })
});