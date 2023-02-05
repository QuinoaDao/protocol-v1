import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Product, Strategy, SwapModule, UsdPriceModule } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

import wMaticAbi from '../abis/wMaticABI.json';
import usdcAbi from '../abis/usdcABI.json';
import wEthAbi from '../abis/wEthABI.json';
import quickAbi from '../abis/quickABI.json';
import ghstAbi from '../abis/ghstABI.json';
import { parseUnits } from "ethers/lib/utils";

const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const wethAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const ghstAddress = "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7";
const quickAddress = "0xB5C064F955D8e7F38fE0460C556a72987494eE17";
const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const usdcProxyAddress = "0xDD9185DB084f5C4fFf3b4f70E7bA62123b812226"

const wmaticOracle = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
const wethOracle = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
const ghstOracle = "0xDD229Ce42f11D8Ee7fFf29bDB71C7b81352e11be";
const quickOracle = "0xa058689f4bCa95208bba3F265674AE95dED75B6D";
const usdcOracle = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";

const wmatic_usdc = "0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827";
const wmatic_quick = "0xF3eB2f17eAFBf35e92C965A954c6e7693187057D"

const uniAddress = "0xb33EaAd8d922B1083446DC23f610c2567fB5180f"
const uniOracle = "0xdf0Fb4e4F928d2dCB76f438575fDD8682386e13C"


async function deployContracts() {
    // Deploy the contract to the test network
    const Product = await ethers.getContractFactory("Product");
    const Strategy = await ethers.getContractFactory("Strategy");
    const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");
    const SwapModule = await ethers.getContractFactory("SwapModule");

    const [dac, nonDac] = await ethers.getSigners();

    const swapModule = await SwapModule.deploy(quickSwapFactory, quickSwapRouter);
    await swapModule.deployed();
    const usdPriceModule = await UsdPriceModule.deploy();
    await usdPriceModule.deployed();

    // Product constructor parameter list
    // string memory name_, 
    // string memory symbol_, 
    // address dacAddress_, 
    // string memory dacName_, 
    // address usdPriceModule_,
    // address swapModule_,
    // address underlyingAssetAddress_,
    // address[] memory assetAddresses_, 
    // uint256 floatRatio_, 
    // uint256 deviationThreshold_ 
    const product = await Product.deploy("Quinoa test Product", "qTEST", dac.address, "Quinoa DAC", usdPriceModule.address, swapModule.address, usdcAddress, [wmaticAddress, wethAddress], 20000, 5000);
    await product.deployed();

    const wmaticStrategy = await Strategy.deploy(wmaticAddress, product.address);
    await wmaticStrategy.deployed();
    const wethStrategy = await Strategy.deploy(wethAddress, product.address);
    await wethStrategy.deployed();
    const ghstStrategy = await Strategy.deploy(ghstAddress, product.address);
    await ghstStrategy.deployed();
    const quickStrategy = await Strategy.deploy(quickAddress, product.address);await usdPriceModule.deployed();
    await quickStrategy.deployed();
    const usdcStrategy = await Strategy.deploy(usdcAddress, product.address);
    await usdcStrategy.deployed();

    // non dac member depoly bad strategy 1
    const nonDacStrategy = await Strategy.connect(nonDac).deploy(wmaticAddress, product.address);
    await nonDacStrategy.deployed();
    // bad strategy 2 uses uni token that product doesn't use
    const diffAssetStrategy = await Strategy.deploy(uniAddress, product.address);
    await diffAssetStrategy.deployed();
    // bad strategy 3 is duplicated strategy with wmaticStrategy
    const dupStrategy = await Strategy.deploy(wmaticAddress, product.address)
    await dupStrategy.deployed();

    return {
      dac, nonDac, 
      product, wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule, swapModule, 
      nonDacStrategy, diffAssetStrategy, dupStrategy
    };
}

async function setUsdPriceModule(usdPriceModule: UsdPriceModule) {
  await usdPriceModule.addUsdPriceFeed(wmaticAddress, wmaticOracle);
  await usdPriceModule.addUsdPriceFeed(wethAddress, wethOracle);
  await usdPriceModule.addUsdPriceFeed(ghstAddress, ghstOracle);
  await usdPriceModule.addUsdPriceFeed(quickAddress, quickOracle);
  await usdPriceModule.addUsdPriceFeed(usdcAddress, usdcOracle);
  await usdPriceModule.addUsdPriceFeed(uniAddress, uniOracle);
}

async function setProduct(
  product: Product, 
  wmaticStrategy: Strategy,
   wethStrategy: Strategy, 
   ghstStrategy: Strategy, 
   quickStrategy: Strategy, 
   usdcStrategy: Strategy
   ) 
{
  // 나머지 asset add 
  await product.addAsset(ghstAddress);
  await product.addAsset(quickAddress);

  // strategy add
  await product.addStrategy(wmaticStrategy.address);
  await product.addStrategy(ghstStrategy.address);
  await product.addStrategy(quickStrategy.address);
  await product.addStrategy(wethStrategy.address);
  await product.addStrategy(usdcStrategy.address);
  
  // update weight 해서 원하는 weight까지 
  product.updateWeight([usdcAddress, ghstAddress, wmaticAddress, wethAddress, quickAddress], [30000, 5000, 40000, 20000, 5000]);

  // withdrawal queue update
  await product.updateWithdrawalQueue([wmaticStrategy.address, wethStrategy.address, usdcStrategy.address, ghstStrategy.address, quickStrategy.address]);

}

async function getTokens(dac: SignerWithAddress) {
    const wMaticContract = new ethers.Contract(wmaticAddress, wMaticAbi, dac);
    const wEthContract = new ethers.Contract(wethAddress, wEthAbi, dac)
    const usdcContract = new ethers.Contract(usdcProxyAddress, usdcAbi, dac)
    const quickContract = new ethers.Contract(quickAddress, quickAbi, dac);
    const ghstContract = new ethers.Contract(ghstAddress, ghstAbi, dac); 

    await wMaticContract.deposit({from: dac.address, value: ethers.utils.parseEther("1000"), gasLimit: 59999});

    return {wMaticContract, wEthContract, usdcContract, quickContract, ghstContract};
}

/**
describe('matic - wmatic test',async () => {
    it('matic - wmatic convert',async () => {
        const {
            dac, nonDac, 
            product, wmaticStrategy, 
            wethStrategy, ghstStrategy, 
            quickStrategy, usdcStrategy, 
            usdPriceModule, swapModule, 
            nonDacStrategy, diffAssetStrategy, dupStrategy
        } = await deployContracts();
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
        const wMaticContract = new ethers.Contract(wmaticAddress, wMaticAbi, dac);
        
        console.log("Before dac matic balance: ", await dac.getBalance());
        console.log("Before dac wMatic balance: ", await wMaticContract.balanceOf(dac.address))
        expect((await wMaticContract.balanceOf(dac.address)).toString()).equal("0");
        await wMaticContract.deposit({from: dac.address, value: ethers.utils.parseEther("1000"), gasLimit: 59999});
        console.log("Before dac matic balance: ", await dac.getBalance());
        console.log("Before dac wMatic balance: ", await wMaticContract.balanceOf(dac.address))
        expect((await wMaticContract.balanceOf(dac.address)).toString()).equal((ethers.utils.parseEther("1000")).toString());
    })
})
*/

describe('swapModule test',async () => {
    it('wmatic - usdc convert: swapExactOutput',async () => {
        const {
            dac, nonDac, 
            product, wmaticStrategy, 
            wethStrategy, ghstStrategy, 
            quickStrategy, usdcStrategy, 
            usdPriceModule, swapModule, 
            nonDacStrategy, diffAssetStrategy, dupStrategy
        } = await deployContracts();
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
        const {wMaticContract, wEthContract, usdcContract, quickContract, ghstContract} = await getTokens(dac);

        console.log("wmatic price: ", (await usdPriceModule.getAssetUsdPrice(wmaticAddress)).toString())
        console.log("usdc price: ", (await usdPriceModule.getAssetUsdPrice(usdcAddress)).toString())
        
        console.log("Before wMatic balance", await wMaticContract.balanceOf(dac.address));
        console.log("Before usdc balance", await usdcContract.balanceOf(dac.address));

        let amountInEstimated = await swapModule.callStatic.estimateSwapInputAmount(ethers.utils.parseUnits("100", 6), wmaticAddress, usdcAddress);
        console.log("Amount in estimated balance: ", amountInEstimated);

        await wMaticContract.approve(wmatic_usdc, amountInEstimated);
        console.log("allowance: ", await wMaticContract.allowance(dac.address, quickSwapRouter));

        await swapModule.swapExactOutput(ethers.utils.parseUnits("100", 6), wmaticAddress, usdcAddress, dac.address);
        console.log("After wMatic balance", await wMaticContract.balanceOf(dac.address));
        console.log("After usdc balance", await usdcContract.balanceOf(dac.address));
    })

    it('wmatic - quick convert',async () => {
        const {
            dac, nonDac, 
            product, wmaticStrategy, 
            wethStrategy, ghstStrategy, 
            quickStrategy, usdcStrategy, 
            usdPriceModule, swapModule, 
            nonDacStrategy, diffAssetStrategy, dupStrategy
        } = await deployContracts();
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
        const {wMaticContract, wEthContract, usdcContract, quickContract, ghstContract} = await getTokens(dac);

        console.log("wmatic price: ", (await usdPriceModule.getAssetUsdPrice(wmaticAddress)).toString())
        console.log("quick price: ", (await usdPriceModule.getAssetUsdPrice(quickAddress)).toString())
        
        console.log("Before wMatic balance", await wMaticContract.balanceOf(dac.address));
        console.log("Before quick balance", await quickContract.balanceOf(dac.address));

        let amountInEstimated = await swapModule.callStatic.estimateSwapInputAmount(ethers.utils.parseUnits("100", 18), wmaticAddress, quickAddress);
        console.log("Amount in estimated balance: ", amountInEstimated);

        await wMaticContract.approve(wmatic_quick, amountInEstimated);
        console.log("allowance: ", await wMaticContract.allowance(dac.address, quickSwapRouter));

        await swapModule.swapExactOutput(ethers.utils.parseUnits("1", 18), wmaticAddress, quickAddress, dac.address);
        console.log("After wMatic balance", await wMaticContract.balanceOf(dac.address));
        console.log("After quick balance", await quickContract.balanceOf(dac.address));  
    })

})