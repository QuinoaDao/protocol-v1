import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract, Signer, utils } from "ethers";
import { Product, Strategy, UsdPriceModule, ERC20, contracts } from "../typechain-types";

import wMaticAbi from "../abis/wMaticABI.json";
import usdcAbi from "../abis/usdcABI.json";
import wEthAbi from "../abis/wEthABI.json";
import quickSwapAbi from "../abis/quickSwapABI.json";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { days } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const wethAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

const wmaticOracle = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
const wethOracle = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
const usdcOracle = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";
const ghstOracle = "0xDD229Ce42f11D8Ee7fFf29bDB71C7b81352e11be";
const quickOracle = "0xa058689f4bCa95208bba3F265674AE95dED75B6D";

const uniAddress = "0xb33EaAd8d922B1083446DC23f610c2567fB5180f";
const uniOracle = "0xdf0Fb4e4F928d2dCB76f438575fDD8682386e13C";

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

async function deployContracts(dac: SignerWithAddress, nonDac: SignerWithAddress) {
    // Deploy the contract to the test network
    const Product = await ethers.getContractFactory("Product");
    const Strategy = await ethers.getContractFactory("Strategy");
    const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");

  
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
  
    const product = await Product.deploy(productInfo, usdPriceModule.address, usdPriceModule.address, [wmaticAddress, wethAddress], quickSwapFactory, quickSwapRouter);
    await product.deployed();
  
    const wmaticStrategy = await Strategy.deploy(dac.address, wmaticAddress, product.address);
    await wmaticStrategy.deployed();
    const wethStrategy = await Strategy.deploy(dac.address, wethAddress, product.address);
    await wethStrategy.deployed();
    const usdcStrategy = await Strategy.deploy(dac.address, usdcAddress, product.address);
    await usdcStrategy.deployed();

    console.log("wmatic strategy: ", wmaticStrategy.address);
    console.log("weth strategy: ", wethStrategy.address);
    console.log("usdc strategy: ", usdcStrategy.address);

    return {
      product,
      wmaticStrategy,
      wethStrategy,
      usdcStrategy,
      usdPriceModule
    };
}
  
async function setUsdPriceModule(usdPriceModule: UsdPriceModule) {
    await usdPriceModule.addUsdPriceFeed(wmaticAddress, wmaticOracle);
    await usdPriceModule.addUsdPriceFeed(wethAddress, wethOracle);
    await usdPriceModule.addUsdPriceFeed(usdcAddress, usdcOracle);
    await usdPriceModule.addUsdPriceFeed(uniAddress, uniOracle);

    console.log("wmatic price: ", await usdPriceModule.getAssetUsdPrice(wmaticAddress));
    console.log("weth price: ", await usdPriceModule.getAssetUsdPrice(wethAddress));
    console.log("usdc price: ", await usdPriceModule.getAssetUsdPrice(usdcAddress));
}
  
async function setProduct(
    product: Product,
    wmaticStrategy: Strategy,
    wethStrategy: Strategy,
    usdcStrategy: Strategy,
) {
    // strategy add
    await product.addStrategy(wmaticStrategy.address);
    await product.addStrategy(wethStrategy.address);
    await product.addStrategy(usdcStrategy.address);
  
    // update weight 해서 원하는 weight까지
    await product.updateWeight(
      [usdcAddress, wmaticAddress, wethAddress],
      [40000, 30000, 30000]
    );
  
    // withdrawal queue update
    await product.updateWithdrawalQueue([
      wmaticStrategy.address,
      wethStrategy.address,
      usdcStrategy.address
    ]);
}
  
async function distributionTokens(signers: SignerWithAddress[]) {
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

async function activateProduct(dac: SignerWithAddress, product: Product, wMaticContract: Contract) {
    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    await product.activateProduct();
}

describe("scenario 5",async () => {
    it('USDC 거래량 더 많게, rebalancing 4번, quick/ghst 미포함',async () => {
        const signers = await ethers.getSigners();
        const {
            product, wmaticStrategy, 
            wethStrategy, usdcStrategy, 
            usdPriceModule
        } = await deployContracts(signers[0], signers[1]);
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, usdcStrategy);
        const { 
            wMaticContract,
            wEthContract,
            usdcContract,
            swapContract
        } =await distributionTokens(signers);
        await activateProduct(signers[0], product, wMaticContract);
        
        let dacDepositValue = (await product.shareValue(await product.totalSupply())).toString();

        let productPortfolioValue_1 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_1 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_1 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_1 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_1 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_1 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_1 = (await product.assetValue(usdcAddress)).toString();

        let assetChoices_deposit = [
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
          ];
        let assetChoices_withdraw = [
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
          ];
        let assetValue_deposit = [
            '0',                    '49394764295131150000', '41725565229972690000',
            '25765719404216110000', '49344466762484466000', '44487950139592850000',
            '46129488999198280000', '33724688013327516000', '21323548389647050000',
            '29165020756008882000', '45969774540562280000', '47157915768663950000',
            '48843082712280500000', '36603374209776583000', '23482176808152100000',
            '28875226225528283000', '40543009142009364000', '30917232355207280000',
            '25007416117482640000', '29318981071679360000', '36226481051251160000',
            '26003087093521113000', '49129692945299276000', '35231534770795420000',
            '32790474352697033000', '23265922239028077000', '29032481423810695000',
            '20030059646969987000', '40599349552253290000', '43804880119121460000',
            '24488845940566688000', '32423269202481980000', '39300180889620970000',
            '37679967681466790000', '30650764561233535000', '38278974535479770000',
            '20148491868593630000', '30202020573412246000', '26050608839411884000',
            '44620324745979210000', '38854837244217870000', '23256095937315705000',
            '35347505099334480000', '40272487987496305000', '27779923091907310000',
            '33285735163368930000', '20407240331240400000', '38839323909225570000',
            '30127917339207050000', '48795340751949990000', '46109180359535540000',
            '32491100104941945000', '29870677344268790000', '26585973123080010000',
            '42900498275959095000', '45682176564637680000', '24689107223182385000',
            '44230665310885810000', '31815834547069575000', '33212472630445945000',
            '40651331424474055000', '21243188825799700000', '23471899649719656000',
            '23506453068279840000', '44124969426178870000', '21040790328969015000',
            '30422366756403184000', '39240984193168840000', '36085249039385680000',
            '45094192761689980000', '32672069427124433000', '36130693509948703000',
            '49282358864784670000', '30413491733782990000', '40921922388803700000',
            '36011089224197923000', '35150088745242386000', '44515102730952460000',
            '30690210331878140000', '39656720111547650000', '44983887008873790000',
            '46440268724919170000', '38092267628000756000', '33084640665703817000',
            '37914878952027900000', '25622797992351860000', '24979136351837532000',
            '47912381336277990000', '24663887565489090000', '45124543332160360000',
            '27403826422473597000', '33577529398829870000', '28863848984950540000',
            '44485392728791196000', '23293460738896286000', '21826530109978160000',
            '23146418904633733000', '45664028809774105000', '41087931911425980000',
            '33067060534204090000', '28607606466219835000', '28551634512678674000',
            '37655801268879300000', '26967829678999642000', '23342532735862903000',
            '42314383823991550000', '32299999489888960000', '45722941703873446000',
            '41194297204879475000', '48035421662481970000', '35172706055830410000',
            '37248097249550710000', '44162497295146340000', '22360931828389544000',
            '38029678244100700000', '20989195628776860000', '29029983937396875000',
            '26755773479519035000', '25319240396892774000', '26287839889831560000',
            '30430223187928610000', '35453516420253430000', '23638444138733416000',
            '29977554856614445000', '40344393114260830000', '32419941302127820000',
            '42011734173451895000', '45195022435646145000', '29463424194136203000',
            '32154558327748256000', '43610157048875430000', '24822748306841090000',
            '46773018712901140000', '22319002723073870000', '42420892490680480000',
            '49865683615816020000', '48642917972568900000', '26813292534055436000',
            '38765982219314000000', '45822852398178640000', '47458751089863540000',
            '23707750795084116000', '28395209204372087000', '42862958034929880000',
            '36762771511560483000', '30014407804026200000', '29631777432112100000',
            '49784063533345096000', '41588834188549980000', '34656221593442222000',
            '36264475835698012000', '28453423457765523000', '21260551901209203000',
            '42461923341022920000', '36549044451783827000', '34155153979542356000',
            '32448486034802940000', '22150720430665626000', '42803139032942990000',
            '32835683510558933000', '46116604210847600000', '42103125007168560000',
            '37001654058198065000', '25664223128104690000', '36086951396118210000',
            '39780940400898210000', '28133512357987627000', '33848190269873150000',
            '45041883606895790000', '45665989365530165000', '39020075262742690000',
            '47111616309997910000', '21948945844823570000', '32407439321281500000',
            '45116108424755310000', '39973219407844900000', '21966954476374753000',
            '30727752314277350000', '34498869777554514000', '27767587466561634000',
            '21989861707671286000', '43370979145546040000', '29631746421921243000',
            '30706576570760230000', '47117155979489640000', '47506259959843320000',
            '46449404894878370000', '27179669810835280000', '45464088960144280000',
            '37631926666510385000', '21250619973418533000', '43451628217824395000',
            '41613717893348620000', '42419572218537710000', '46317890264820830000',
            '21175659314877563000', '39110444459340090000', '23597427222949028000',
            '40168915087492090000', '32825212837444723000', '41983095466295250000',
            '33946628992646717000', '35035581351831140000', '35466382210449154000',
            '24938675273554715000', '37897745000054530000', '20731785055807676000',
            '35804631737392636000', '29333593058090967000', '27690697488348170000',
            '21011925554652357000', '40318538478670490000', '23665433391035814000',
            '30937432382127040000', '28828019872434323000', '40198496477881430000',
            '22769841526283567000', '49601920701836706000', '44988855943591260000',
            '30103067965619425000', '42037835218183750000', '45705501617047470000',
            '48527591147656040000', '38671122598285610000', '20526749640107410000',
            '43244355244980790000', '20081150111613137000', '40205259187496080000',
            '43961454325475950000', '33558301328133410000', '49851718856142135000',
            '43265011499816790000', '43766888479697370000', '47240724937003794000',
            '42079943218465780000', '45075609092417020000', '23718971234244200000',
            '46900248206738280000', '25075659934688535000', '24992115496646337000',
            '49235607590121456000', '24567590401781453000', '35593384315738325000',
            '45821955757022360000', '27444177416434220000', '25930407566386390000',
            '25671431148109840000', '40074996935839380000', '42565806341036930000',
            '43438575320069440000', '25699703232857633000', '25746690164704590000',
            '33535915348981023000', '46102405448234830000', '49481712164382015000',
            '33162543434730200000', '49917011165775870000', '37984050718809770000',
            '43140085556805650000', '38787032444943980000', '31064562045268860000',
            '44421677401609650000', '35343014119632880000', '48382093015338760000',
            '26851440735451005000', '21920792506867597000', '32642999683518513000',
            '45599216233354625000', '26812985559593460000', '46426466317792000000',
            '29677115702742106000', '43021807729272820000', '30462663458771223000',
            '44947436468853750000', '28243095866613050000', '26357611999717780000',
            '46015050741185200000', '20267770904166994000', '39194383124473460000',
            '36860882786900950000', '42082747372143570000', '46493141134020400000',
            '31184166793801850000', '49143419725953290000', '38918153104816160000',
            '22493590777143837000', '22872035161891670000', '35840364839100445000',
            '25590963721354363000', '30132806446656717000', '28148505191399588000',
            '35313419836474330000', '20543374679285604000', '49842169629430480000',
            '41022386938632650000', '41174284662404740000', '46646045175421650000',
            '24702193800108950000', '27393672079082705000', '49548659727907120000',
            '47437096350749860000'
          ];
        let assetContracts_deposit = [];
        
        for(let i=0; i<301; i++) {
            if(assetChoices_deposit[i] == wmaticAddress) assetContracts_deposit.push(wMaticContract);
            else if(assetChoices_deposit[i] == usdcAddress) assetContracts_deposit.push(usdcContract);
            else if(assetChoices_deposit[i] == wethAddress) assetContracts_deposit.push(wEthContract);
        }

        // deposit 1
        for (let i=1; i<151; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);
            
            await delay(50);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);

            // usdc를 사용하는 pair는 deposit 금액 더 많게
            if(depositAddress == usdcAddress || assetChoices_withdraw[i] == usdcAddress) {
                await depositContract.connect(signers[i]).approve(product.address, depositBalance);
                await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address); 
                assetValue_deposit[i] = (await usdPriceModule.getAssetUsdValue(depositAddress, depositBalance.mul(2))).toString();
            }

            console.log("deposit: ", i);
        }

        let productPortfolioValue_2 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_2 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_2 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_2 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_2 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_2 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_2 = (await product.assetValue(usdcAddress)).toString();

        // rebalance 1
        await product.rebalance();

        let productPortfolioValue_3 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_3 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_3 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_3 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_3 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_3 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_3 = (await product.assetValue(usdcAddress)).toString();

        // deposit 2
        for (let i=151; i<301; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);

            await delay(50);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);

            // usdc를 사용하는 pair는 deposit 금액 더 많게
            if(depositAddress == usdcAddress || assetChoices_withdraw[i] == usdcAddress) {
                await depositContract.connect(signers[i]).approve(product.address, depositBalance);
                await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address); 
                assetValue_deposit[i] = (await usdPriceModule.getAssetUsdValue(depositAddress, depositBalance.mul(2))).toString();
            }

            console.log("deposit: ", i);
        }

        let productPortfolioValue_4 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_4 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_4 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_4 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_4 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_4 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_4 = (await product.assetValue(usdcAddress)).toString();

        // rebalance 2
        await product.rebalance();

        let productPortfolioValue_5 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_5 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_5 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_5 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_5 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_5 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_5 = (await product.assetValue(usdcAddress)).toString();


        // withdraw logic

        const assetContracts_withdraw = [];

        for(let i=0; i<301; i++) {
            if(assetChoices_withdraw[i] == wmaticAddress) assetContracts_withdraw.push(wMaticContract);
            else if(assetChoices_withdraw[i] == usdcAddress) assetContracts_withdraw.push(usdcContract);
            else if(assetChoices_withdraw[i] == wethAddress) assetContracts_withdraw.push(wEthContract);
        }

        let assetValue_withdraw = ["0"];
        let user_shareBalance = ["0"];
        let user_estimatedWithdraw = ["0"];

        // withdraw 1
        console.log("USER,TOKEN_PAIR,DEPOSIT,SHARE,WITHDRAW,ESTIMATED");
        
        for (let i=1; i<151; i++) {
            let withdrawAddress = assetChoices_withdraw[i];
            let withdrawContract = assetContracts_withdraw[i];
            let beforeUserBalance = await withdrawContract.balanceOf(signers[i].address);
            let user_share = await product.balanceOf(signers[i].address);
            user_shareBalance.push((user_share).toString());
            user_estimatedWithdraw.push((await product.shareValue(user_share)).toString());

            await delay(50);
            await product.connect(signers[i]).withdraw(withdrawAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address);
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawAddress, (await withdrawContract.balanceOf(signers[i].address)).sub(beforeUserBalance));

            assetValue_withdraw.push((userWithdrawValue).toString());
            console.log(i, assetChoices_deposit[i], "-", assetChoices_withdraw[i], user_shareBalance[i],assetValue_deposit[i], assetValue_withdraw[i], user_estimatedWithdraw[i]);
        }

        let productPortfolioValue_6 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_6 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_6 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_6 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_6 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_6 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_6 = (await product.assetValue(usdcAddress)).toString();

        // rebalance 3
        await product.rebalance();

        let productPortfolioValue_7 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_7 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_7 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_7 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_7 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_7 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_7 = (await product.assetValue(usdcAddress)).toString();
        
        // withdraw 2
        for (let i=151; i<301; i++) {
            let withdrawAddress = assetChoices_withdraw[i];
            let withdrawContract = assetContracts_withdraw[i];
            let beforeUserBalance = await withdrawContract.balanceOf(signers[i].address);
            let user_share = await product.balanceOf(signers[i].address);
            user_shareBalance.push((user_share).toString());
            user_estimatedWithdraw.push((await product.shareValue(user_share)).toString());

            await delay(50);
            await product.connect(signers[i]).withdraw(withdrawAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address);
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawAddress, (await withdrawContract.balanceOf(signers[i].address)).sub(beforeUserBalance));

            assetValue_withdraw.push((userWithdrawValue).toString());
            console.log(i, assetChoices_deposit[i], "-", assetChoices_withdraw[i], user_shareBalance[i],assetValue_deposit[i], assetValue_withdraw[i], user_estimatedWithdraw[i]);
        }
        
        let productPortfolioValue_8 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_8 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_8 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_8 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_8 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_8 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_8 = (await product.assetValue(usdcAddress)).toString();

        // rebalance 4
        await product.rebalance();

        let productPortfolioValue_9 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_9 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_9 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_9 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_9 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_9 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_9 = (await product.assetValue(usdcAddress)).toString();

        let dacWithdrawValue = (await product.shareValue(await product.totalSupply())).toString();


        let tokenPrice_wmatic = (await usdPriceModule.getAssetUsdPrice(wmaticAddress)).toString();
        let tokenPrice_weth = (await usdPriceModule.getAssetUsdPrice(wethAddress)).toString();
        let tokenPrice_usdc = (await usdPriceModule.getAssetUsdPrice(usdcAddress)).toString();
    
        ///////////////////////////////////////////////////////////////////////////////////////
        
        console.log("DEPOSIT_WITHDRAW_WITH_REBALANCING,assetName,assetBalance,assetValue,assetPrice,productPortfolio");

        // before deposit
        console.log("BEFORE_DEPOSIT,wMatic", productBalance_wmatic_1, productValue_wmatic_1, tokenPrice_wmatic, productPortfolioValue_1);
        console.log("BEFORE_DEPOSIT,wEth", productBalance_weth_1, productValue_weth_1, tokenPrice_weth, productPortfolioValue_1);
        console.log("BEFORE_DEPOSIT,usdc", productBalance_usdc_1, productValue_usdc_1, tokenPrice_usdc, productPortfolioValue_1);
        console.log("\n");

        // after deposit before rebalance
        console.log("BEFORE_1,wMatic", productBalance_wmatic_2, productValue_wmatic_2, tokenPrice_wmatic, productPortfolioValue_2);
        console.log("BEFORE_1,wEth", productBalance_weth_2, productValue_weth_2, tokenPrice_weth, productPortfolioValue_2);
        console.log("BEFORE_1,usdc", productBalance_usdc_2, productValue_usdc_2, tokenPrice_usdc, productPortfolioValue_2);
        console.log("\n");

        // after withdraw
        console.log("AFTER_1,wMatic", productBalance_wmatic_3, productValue_wmatic_3, tokenPrice_wmatic, productPortfolioValue_3);
        console.log("AFTER_1,wEth", productBalance_weth_3, productValue_weth_3, tokenPrice_weth, productPortfolioValue_3);
        console.log("AFTER_1,usd", productBalance_usdc_3, productValue_usdc_3, tokenPrice_usdc, productPortfolioValue_3);
        console.log("\n");

        // after withdraw
        console.log("BEFORE_2,wMatic", productBalance_wmatic_4, productValue_wmatic_4, tokenPrice_wmatic, productPortfolioValue_4);
        console.log("BEFORE_2,wEth", productBalance_weth_4, productValue_weth_4, tokenPrice_weth, productPortfolioValue_4);
        console.log("BEFORE_2,usd", productBalance_usdc_4, productValue_usdc_4, tokenPrice_usdc, productPortfolioValue_4);
        console.log("\n");

        // before deposit
        console.log("AFTER_2,wMatic", productBalance_wmatic_5, productValue_wmatic_5, tokenPrice_wmatic, productPortfolioValue_5);
        console.log("AFTER_2,wEth", productBalance_weth_5, productValue_weth_5, tokenPrice_weth, productPortfolioValue_5);
        console.log("AFTER_2,usdc", productBalance_usdc_5, productValue_usdc_5, tokenPrice_usdc, productPortfolioValue_5);
        console.log("\n");

        // after deposit before rebalance
        console.log("BEROE_3,wMatic", productBalance_wmatic_6, productValue_wmatic_6, tokenPrice_wmatic, productPortfolioValue_6);
        console.log("BEROE_3,wEth", productBalance_weth_6, productValue_weth_6, tokenPrice_weth, productPortfolioValue_6);
        console.log("BEROE_3,usdc", productBalance_usdc_6, productValue_usdc_6, tokenPrice_usdc, productPortfolioValue_6);
        console.log("\n");

        // after withdraw
        console.log("AFTER_3,wMatic", productBalance_wmatic_7, productValue_wmatic_7, tokenPrice_wmatic, productPortfolioValue_7);
        console.log("AFTER_3,wEth", productBalance_weth_7, productValue_weth_7, tokenPrice_weth, productPortfolioValue_7);
        console.log("AFTER_3,usd", productBalance_usdc_7, productValue_usdc_7, tokenPrice_usdc, productPortfolioValue_7);
        console.log("\n");

        // after withdraw
        console.log("BEFORE_4,wMatic", productBalance_wmatic_8, productValue_wmatic_8, tokenPrice_wmatic, productPortfolioValue_8);
        console.log("BEFORE_4,wEth", productBalance_weth_8, productValue_weth_8, tokenPrice_weth, productPortfolioValue_8);
        console.log("BEFORE_4,usd", productBalance_usdc_8, productValue_usdc_8, tokenPrice_usdc, productPortfolioValue_8);
        console.log("\n");

        // after withdraw
        console.log("AFTER_4,wMatic", productBalance_wmatic_9, productValue_wmatic_9, tokenPrice_wmatic, productPortfolioValue_9);
        console.log("AFTER_4,wEth", productBalance_weth_9, productValue_weth_9, tokenPrice_weth, productPortfolioValue_9);
        console.log("AFTER_4,usd", productBalance_usdc_9, productValue_usdc_9, tokenPrice_usdc, productPortfolioValue_9);
        console.log("\n");

        // dac deposit-withdraw value
        console.log("DAC_DEPOSIT_VALUE", dacDepositValue);
        console.log("DAC_WITHDRAW_VALUE", dacWithdrawValue);
        console.log("\n");


        // user deposit-withdraw value
        // console.log("USER,TOKEN_PAIR,DEPOSIT,WITHDRAW");
        // for (let i=1; i<301; i++) {
        //     console.log(i, assetChoices_deposit[i], "-", assetChoices_withdraw[i], assetValue_deposit[i], assetValue_withdraw[i]);
        // }

    })
})