import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { Product, Strategy, UsdPriceModule, ERC20, contracts } from "../typechain-types";

import wMaticAbi from "../abis/wMaticABI.json";
import usdcAbi from "../abis/usdcABI.json";
import wEthAbi from "../abis/wEthABI.json";
import quickSwapAbi from "../abis/quickSwapABI.json";
import { parseEther, parseUnits } from "ethers/lib/utils";

export const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
export const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

export const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
export const wethAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
export const ghstAddress = "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7";
export const quickAddress = "0x831753dd7087cac61ab5644b308642cc1c33dc13";
export const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

export const wmaticOracle = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
export const wethOracle = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
export const ghstOracle = "0xDD229Ce42f11D8Ee7fFf29bDB71C7b81352e11be";
export const quickOracle = "0xa058689f4bCa95208bba3F265674AE95dED75B6D";
export const usdcOracle = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";

export const uniAddress = "0xb33EaAd8d922B1083446DC23f610c2567fB5180f"
export const uniOracle = "0xdf0Fb4e4F928d2dCB76f438575fDD8682386e13C"

export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export async function deployContracts(dac: SignerWithAddress, nonDac: SignerWithAddress) {
    // Deploy the contract to the test network
    const Product = await ethers.getContractFactory("Product");
    const Strategy = await ethers.getContractFactory("Strategy");
    const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");
    const WhitelistRegistry = await ethers.getContractFactory("WhitelistRegistry");

    const whitelistRegistry = await WhitelistRegistry.deploy();
    await whitelistRegistry.deployed();
  
    const usdPriceModule = await UsdPriceModule.deploy();
    await usdPriceModule.deployed();
  
    const productInfo = {
        productName: "Quinoa test Product",
        productSymbol: "qTEST",
        dacName: "Quinoa DAC",
        dacAddress: dac.address,
        underlyingAssetAddress: usdcAddress,
        floatRatio: 20000,
        deviationThreshold: 5000
    }
  
    const product = await Product.deploy(productInfo, whitelistRegistry.address, usdPriceModule.address, usdPriceModule.address, [wmaticAddress, wethAddress], quickSwapFactory, quickSwapRouter);
    await product.deployed();
  
    const wmaticStrategy = await Strategy.deploy(dac.address, wmaticAddress, product.address);
    await wmaticStrategy.deployed();
    const wethStrategy = await Strategy.deploy(dac.address, wethAddress, product.address);
    await wethStrategy.deployed();
    const usdcStrategy = await Strategy.deploy(dac.address, usdcAddress, product.address);
    await usdcStrategy.deployed();
    const ghstStrategy = await Strategy.deploy(dac.address, ghstAddress, product.address);
    await ghstStrategy.deployed();
    const quickStrategy = await Strategy.deploy(dac.address, quickAddress, product.address);await usdPriceModule.deployed();
    await quickStrategy.deployed();

    return {
      product,
      wmaticStrategy,
      wethStrategy,
      usdcStrategy,
      ghstStrategy,
      quickStrategy,
      usdPriceModule,
      whitelistRegistry
    };
}

export async function setUsdPriceModule(dac: SignerWithAddress, usdPriceModule: UsdPriceModule) {
    await usdPriceModule.connect(dac).addUsdPriceFeed(wmaticAddress, wmaticOracle);
    await usdPriceModule.connect(dac).addUsdPriceFeed(wethAddress, wethOracle);
    await usdPriceModule.connect(dac).addUsdPriceFeed(usdcAddress, usdcOracle);
    await usdPriceModule.connect(dac).addUsdPriceFeed(uniAddress, uniOracle);
    await usdPriceModule.connect(dac).addUsdPriceFeed(ghstAddress, ghstOracle);
    await usdPriceModule.connect(dac).addUsdPriceFeed(quickAddress, quickOracle);
}

export async function setProductWithAllStrategy(
    dac: SignerWithAddress, 
    product: Product,
    wmaticStrategy: Strategy,
    wethStrategy: Strategy,
    usdcStrategy: Strategy,
    ghstStrategy: Strategy,
    quickStrategy: Strategy
) {
    // strategy add
    await product.connect(dac).addAsset(ghstAddress);
    await product.connect(dac).addAsset(quickAddress);
    await product.connect(dac).addStrategy(wmaticStrategy.address);
    await product.connect(dac).addStrategy(wethStrategy.address);
    await product.connect(dac).addStrategy(usdcStrategy.address);
    await product.connect(dac).addStrategy(ghstStrategy.address);
    await product.connect(dac).addStrategy(quickStrategy.address);
  
    // update weight 해서 원하는 weight까지
    await product.connect(dac).updateWeight(
        [usdcAddress, ghstAddress, wmaticAddress, wethAddress, quickAddress], 
        [30000, 5000, 40000, 20000, 5000]
    );
  
    // withdrawal queue update
    await product.connect(dac).updateWithdrawalQueue([
      wmaticStrategy.address,
      wethStrategy.address,
      usdcStrategy.address,
      ghstStrategy.address, 
      quickStrategy.address
    ]);
}

export async function setProductWithoutQuickAndGhst(
    dac: SignerWithAddress, 
    product: Product,
    wmaticStrategy: Strategy,
    wethStrategy: Strategy,
    usdcStrategy: Strategy,
) {
    // strategy add
    await product.connect(dac).addStrategy(wmaticStrategy.address);
    await product.connect(dac).addStrategy(wethStrategy.address);
    await product.connect(dac).addStrategy(usdcStrategy.address);
  
    // update weight 해서 원하는 weight까지
    await product.connect(dac).updateWeight(
      [usdcAddress, wmaticAddress, wethAddress],
      [40000, 30000, 30000]
    );
  
    // withdrawal queue update
    await product.connect(dac).updateWithdrawalQueue([
      wmaticStrategy.address,
      wethStrategy.address,
      usdcStrategy.address
    ]);
}

export async function distributionTokens(signers: SignerWithAddress[]) {
    const wMaticContract = new ethers.Contract(wmaticAddress, wMaticAbi, signers[0]);
    const wEthContract = new ethers.Contract(wethAddress, wEthAbi, signers[0]);
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, signers[0]);
    const swapContract = new ethers.Contract(quickSwapRouter, quickSwapAbi, signers[0]);

    let cnt = 0;

    for(const val of signers) {
        // wmatic
        await wMaticContract
        .connect(val)
        .deposit
        ({
            from: val.address,
            value: ethers.utils.parseEther("1000"),
            gasLimit: 59999,
        });

        // weth
        let amountOut = parseUnits("3", 17);
        let path = [wmaticAddress, wethAddress];
        let amountIn = parseEther("450");
    
        await wMaticContract.connect(val).approve(quickSwapRouter, amountIn);
        await swapContract.connect(val).swapTokensForExactTokens(amountOut, amountIn, path, val.address, Date.now() + 10000*60, {gasLimit: 251234});
    
        // usdc
        amountOut = parseUnits("300", 6);
        path = [wmaticAddress, usdcAddress];
        amountIn = parseEther("350");

        await wMaticContract.connect(val).approve(quickSwapRouter, amountIn);
        await swapContract.connect(val).swapTokensForExactTokens(amountOut, amountIn, path, val.address, Date.now() + 10000*60, {gasLimit: 251234});

        console.log("distribution: ", cnt);
        cnt+=1;
    }

    return {
        wMaticContract,
        wEthContract,
        usdcContract,
        swapContract
      };
}

export async function activateProduct(dac: SignerWithAddress, product: Product, wMaticContract: Contract) {
    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    await product.activateProduct();
}

